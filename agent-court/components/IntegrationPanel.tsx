"use client";
import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatErrorBoundary, CometChatMessageComposer, CometChatMessageHeader, CometChatMessageList, CometChatProvider, CometChatUIKit, useCometChatEvents } from "@cometchat/chat-uikit-react";
import "@cometchat/chat-uikit-react/styles";
import { connectCometChat as connect, demoPost as post } from "@/lib/cometchat-client";

const HUMAN = "human_judge";
type Setup = { guid: string; members: { uid: string; name: string }[] };
type Token = { uid: string; authToken: string; appId: string; region: string };
type MessageProof = { id: string; sender: string; receiver: string; text: string; sentAt: number };

function GroupSurface({ group }: { group: CometChat.Group }) {
  const [human, setHuman] = useState<MessageProof | null>(null);
  const [received, setReceived] = useState<MessageProof | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [historyVerified, setHistoryVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  useCometChatEvents(event => {
    if (event.type === "connection/disconnected") setOnline(false);
    if (event.type === "connection/connected") setOnline(true);
    if (event.type === "ui:message/sent" && event.status === "success" && event.message.getReceiverId() === group.getGuid() && event.message.getSender()?.getUid() === HUMAN) {
      setHistoryVerified(false);
      post<MessageProof>("/api/integration/verify-message", { messageId: String(event.message.getId()), sender: HUMAN }).then(setHuman).catch(() => setError("HUMAN_MESSAGE_READBACK_FAILED"));
    }
    if (event.type === "message/text-received" && event.message.getReceiverId() === group.getGuid() && event.message.getSender()?.getUid() === "executor_agent") {
      setOnline(true);
      post<MessageProof>("/api/integration/verify-message", { messageId: String(event.message.getId()), sender: "executor_agent" }).then(setReceived).catch(() => setError("AGENT_MESSAGE_READBACK_FAILED"));
    }
  }, [group]);
  async function ping() {
    setBusy(true); setError(null); setHistoryVerified(false); setReceived(null);
    try { const sent = await post<{ id: string }>("/api/integration/agent-message"); setAgentId(sent.id); }
    catch { setError("AGENT_SEND_FAILED"); }
    finally { setBusy(false); }
  }
  async function verifyHistory() {
    setBusy(true); setError(null);
    try {
      const messages = await new CometChat.MessagesRequestBuilder().setGUID(group.getGuid()).setLimit(100).build().fetchPrevious();
      setHistoryVerified(Boolean(human && received && agentId === received.id && messages.some(m => String(m.getId()) === human.id) && messages.some(m => String(m.getId()) === agentId)));
    } catch { setError("SDK_HISTORY_FAILED"); }
    finally { setBusy(false); }
  }
  const passed = !error && online && human && received && agentId === received.id && historyVerified;
  return <>
    <section className="gate-evidence" aria-label="Integration evidence">
      <h2>{passed ? "Gate 0 verified in this session" : "Gate 0 verification in progress"}</h2>
      <p>Send a text below as Human Approver, then request an agent message and verify SDK history.</p>
      <ul>
        <li>Human login: <strong>{CometChatUIKit.getLoggedInUser()?.getUid()}</strong></li>
        <li>Realtime connection: {online === null ? "awaiting observed event" : online ? "connected" : "disconnected"}</li>
        <li>Human send + server read-back: {human ? `message ${human.id}` : "pending"}</li>
        <li>Agent incoming realtime + read-back: {received && received.id === agentId ? `message ${received.id}` : "pending"}</li>
        <li>SDK history contains both IDs: {historyVerified ? "verified" : "pending"}</li>
      </ul>
      <button onClick={ping} disabled={busy}>Send real agent message</button>{" "}
      <button onClick={verifyHistory} disabled={busy || !human || !received}>Verify message history</button>
      {error && <p role="alert">{error}</p>}
      <output data-testid="gate-status">{passed ? "GATE0_PASS" : "GATE0_PENDING"}</output>
    </section>
    <section className="chat-pane" aria-label="Live CometChat private group">
      <CometChatMessageHeader group={group} hideBackButton hideVoiceCallButton hideVideoCallButton showSearchOption={false} trailingView={<span>4 verified members</span>} />
      <div className="chat-list"><CometChatMessageList group={group} hideReplyInThreadOption /></div>
      <CometChatMessageComposer group={group} placeholder="Send an integration test message…" hideAttachmentButton hideVoiceRecordingButton hideStickersButton />
    </section>
  </>;
}

export default function IntegrationPanel() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [group, setGroup] = useState<CometChat.Group | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(media.matches ? "dark" : "light");
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  async function open() {
    setBusy(true); setError(null);
    try {
      const roster = await post<Setup>("/api/integration/setup");
      const token = await post<Token>("/api/cometchat/token");
      await connect(token);
      const actual = await CometChat.getGroup(roster.guid);
      if (!actual.getHasJoined() || actual.getType() !== "private") throw new Error("GROUP_NOT_JOINED");
      setSetup(roster); setGroup(actual);
    } catch { setError("CHAT_INTEGRATION_FAILED — inspect the sanitized server response and retry."); }
    finally { setBusy(false); }
  }
  return <div className="integration">
    {!group && <section><h2>Real integration gate</h2><p>This creates four demo users and one private integration group. All REST credentials stay on the server.</p><button onClick={open} disabled={busy}>{busy ? "Connecting…" : "Open integration chat"}</button></section>}
    {error && <p role="alert">{error}</p>}
    {setup && <p className="roster">{setup.members.map(m => m.name).join(" · ")}</p>}
    {group && <CometChatErrorBoundary><CometChatProvider theme={theme}><GroupSurface group={group} /></CometChatProvider></CometChatErrorBoundary>}
  </div>;
}
