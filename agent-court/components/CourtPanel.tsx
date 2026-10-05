"use client";
import { useEffect, useRef, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatMessageComposer, CometChatMessageHeader, CometChatMessageList, CometChatMessageStatus, useCometChatEvents, usePublishEvent } from "@cometchat/chat-uikit-react";
import type { CourtRun } from "@/lib/court-runtime";
import { demoPost, HUMAN_UID } from "@/lib/cometchat-client";
import { euros } from "./ActionCard";

export default function CourtPanel({ run, group, onUpdate }: { run: CourtRun; group: CometChat.Group; onUpdate: (run: CourtRun) => void }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const handled = useRef(new Map<string, Promise<void>>());
  const queueTail = useRef<Promise<void>>(Promise.resolve());
  const pendingCount = useRef(0);
  const latestStatus = useRef(run.status);
  const inFlight = useRef(false);
  const publish = usePublishEvent();
  const waiting = run.status === "WAITING_HUMAN";
  useEffect(() => { latestStatus.current = run.status; }, [run.status]);
  function processDecision(message: CometChat.BaseMessage): Promise<void> {
    if (message.getReceiverId() !== group.getGuid() || message.getSender()?.getUid() !== HUMAN_UID || message.getType() !== "text") return Promise.resolve();
    const id = String(message.getId());
    if (!/^\d+$/.test(id)) return Promise.resolve();
    const existing = handled.current.get(id);
    if (existing) return existing;
    pendingCount.current += 1; setSending(true);
    const processing = queueTail.current.then(async () => {
      // A queued decision following a terminal result cannot reopen execution.
      if (latestStatus.current !== "WAITING_HUMAN") return;
      inFlight.current = true; setError(null);
      try {
        const current = await demoPost<CourtRun>("/api/refund", { runId: run.runId, decisionMessageId: id });
        latestStatus.current = current.status;
        onUpdate(current);
      } catch (failure) { setError(failure instanceof Error ? failure.message : "DECISION_NOT_EXECUTED"); }
      finally { inFlight.current = false; }
    }).finally(() => { pendingCount.current -= 1; setSending(pendingCount.current > 0); });
    handled.current.set(id, processing);
    queueTail.current = processing.catch(() => {});
    return processing;
  }
  useCometChatEvents(event => {
    if (event.type === "connection/disconnected") setDisconnected(true);
    if (event.type === "connection/connected") setDisconnected(false);
    if (event.type === "ui:message/sent" && event.status === "success") void processDecision(event.message);
    if (event.type === "message/text-received") void processDecision(event.message);
  }, [run.runId, run.status, group]);
  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      if (inFlight.current) return;
      try { const current = await demoPost<CourtRun>("/api/court/status", { runId: run.runId }); if (!cancelled) onUpdate(current); }
      catch { if (!cancelled) setError("COURT_STATUS_UNAVAILABLE — action remains blocked."); }
    }, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [run.runId, waiting, onUpdate]);
  async function sendDecision(text: string) {
    setSending(true); setError(null);
    try {
      const message = await CometChat.sendMessage(new CometChat.TextMessage(group.getGuid(), text, CometChat.RECEIVER_TYPE.GROUP));
      const processing = processDecision(message);
      publish({ type: "ui:message/sent", message, status: CometChatMessageStatus.success });
      await processing;
    } catch { setError("MESSAGE_SEND_FAILED — action remains blocked."); }
    finally { setSending(pendingCount.current > 0); }
  }
  return <section className="court-chat-section">
    <div className="court-chat-label"><span className="eyebrow">Live deliberation</span><span className="mono">COMETCHAT · PRIVATE ROOM</span></div>
    <div className="chat-pane court-chat">
      <CometChatMessageHeader group={group} hideBackButton hideVoiceCallButton hideVideoCallButton showSearchOption={false} trailingView={<span className="live-indicator"><i />{waiting ? "Awaiting your decision" : "Court closed"}</span>} />
      <div className="chat-list"><CometChatMessageList group={group} hideReplyInThreadOption /></div>
      {waiting && <CometChatMessageComposer group={group} placeholder={`Approve €${run.risk.policyMaximum} or REJECT…`} hideAttachmentButton hideVoiceRecordingButton hideStickersButton />}
    </div>
    {waiting && <div className="decision-bar"><div><strong>You are the Human Approver.</strong><span>Your decision is sent as a real chat message.</span></div><div className="decision-buttons"><button className="button button-primary" disabled={sending || disconnected} onClick={() => sendDecision(`APPROVE €${run.risk.policyMaximum}`)}>{sending ? "Recording decision…" : `Approve ${euros(run.risk.policyMaximum)}`}</button><button className="button button-outline" disabled={sending || disconnected} onClick={() => sendDecision("REJECT")}>Reject</button></div></div>}
    {disconnected && <p role="alert" className="error-notice">Chat disconnected. Execution remains blocked until the server verifies a recorded human decision.</p>}
    {(error || run.error) && <p role="alert" className="error-notice">Decision not executed: {error || run.error}</p>}
  </section>;
}

