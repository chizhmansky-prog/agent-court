"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatErrorBoundary, CometChatProvider } from "@cometchat/chat-uikit-react";
import "@cometchat/chat-uikit-react/styles";
import type { CourtRun } from "@/lib/court-runtime";
import { connectCometChat, demoPost, type ClientToken } from "@/lib/cometchat-client";
import ActionCard, { euros } from "./ActionCard";
import RiskBadge from "./RiskBadge";
import ReceiptCard from "./ReceiptCard";
import CounterfactualCard from "./CounterfactualCard";
import CourtPanel from "./CourtPanel";
import GateDiagram from "./GateDiagram";

const cases = [
  { caseId: "ORDER-101", amount: 80, age: 12, level: "LOW" as const, index: "01" },
  { caseId: "ORDER-202", amount: 300, age: 36, level: "MEDIUM" as const, index: "02" },
  { caseId: "ORDER-303", amount: 850, age: 72, level: "HIGH" as const, index: "03" },
];
export default function CourtApp() {
  const [run, setRun] = useState<CourtRun | null>(null);
  const [group, setGroup] = useState<CometChat.Group | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeCase, setActiveCase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = useRef<ClientToken | null>(null);
  const resultSection = useRef<HTMLElement | null>(null);
  const updateRun = useCallback((next: CourtRun) => setRun(next), []);
  async function start(caseId: string) {
    setBusy(true); setError(null); setActiveCase(caseId); setRun(null); setGroup(null);
    try {
      if (!token.current) {
        await demoPost("/api/integration/setup");
        token.current = await demoPost<ClientToken>("/api/cometchat/token");
      }
      await connectCometChat(token.current);
      const next = await demoPost<CourtRun>("/api/court/start", { caseId });
      setRun(next);
      if (next.courtGuid) {
        const actual = await CometChat.getGroup(next.courtGuid);
        if (actual.getGuid() !== next.courtGuid || !actual.getHasJoined() || actual.getType() !== "private") throw new Error("COURT_GROUP_NOT_VERIFIED");
        setGroup(actual);
      }
      window.setTimeout(() => resultSection.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }), 50);
    } catch (failure) {
      if (failure instanceof Error && failure.message === "DEMO_SESSION_REQUIRED") token.current = null;
      setError(failure instanceof Error ? failure.message : "COURT_UNAVAILABLE");
    }
    finally { setBusy(false); }
  }
  return <div className="court-app">
    <nav className="site-nav"><Link className="wordmark" href="/"><span className="court-emblem" aria-hidden="true">⌁</span>AGENT COURT</Link><div><span className="demo-mark">SIMULATION / ZERO TO CHAT</span><Link className="evidence-link" href="/integration">Integration evidence ↗</Link></div></nav>
    <main className="product-main">
      <section className="hero"><div className="hero-copy"><span className="eyebrow">A hearing before the harm</span><h1>Before an agent acts,<br /><em>let it make its case.</em></h1><p>AI proposes an action. Evidence challenges it. A human decides. The conversation becomes the gate to execution.</p></div><GateDiagram run={run} /></section>
      <section className="actions-section" aria-labelledby="actions-title"><div className="section-heading"><div><span className="eyebrow">Choose a proposed action</span><h2 id="actions-title">Three cases. Different consequences.</h2></div><span className="mono">DETERMINISTIC POLICY / REAL CHAT</span></div><div className="action-grid">{cases.map(item => <ActionCard key={item.caseId} {...item} active={activeCase === item.caseId} disabled={busy || run?.status === "WAITING_HUMAN" || run?.status === "EXECUTING"} onRun={() => start(item.caseId)} />)}</div><p className="simulation-note">All refunds are simulated. No payment provider is connected and no money moves.</p></section>
      {busy && <div className="case-loading" role="status"><span className="loading-dot" /><span>{activeCase === "ORDER-303" ? "Convening the court. Gathering the agents and their evidence…" : "Evaluating the proposed action…"}</span></div>}
      {error && <div className="error-notice" role="alert"><strong>Action remains blocked.</strong><p>{error}</p><button className="button button-outline" disabled={busy} onClick={() => activeCase && start(activeCase)}>Retry this case</button></div>}
      {run && <section className="case-result" ref={resultSection} aria-labelledby="case-title"><div className="case-result-heading"><div><span className="eyebrow">{run.courtGuid ? "Court convened" : "Policy evaluation"} / {run.orderId}</span><h2 id="case-title">{run.risk.level === "HIGH" ? "The proposed action is challenged." : run.risk.level === "MEDIUM" ? "This case requires agent review." : "Within policy. Cleared to proceed."}</h2></div><RiskBadge level={run.risk.level} /></div><div className="case-layout"><aside className="case-brief"><span className="eyebrow">Case brief</span><dl><div><dt>Requested refund</dt><dd>{euros(run.requestedAmount)}</dd></div><div><dt>Order age</dt><dd>{run.orderAgeHours} hours</dd></div><div><dt>Policy maximum</dt><dd>{euros(run.risk.policyMaximum)}</dd></div></dl><div className="policy-note"><span className="mono">POLICY</span><p>After 48 hours, the maximum refund is 50% of the amount paid.</p><code>{run.risk.policyId}</code></div><p className="case-reason">{run.risk.reason}</p><span className="case-status mono" data-testid="court-status">{run.status.replaceAll("_", " ")}</span></aside><div className="case-content">{run.error && !group && <p className="error-notice" role="alert">Action remains blocked: {run.error}</p>}{run.risk.level === "MEDIUM" && <section className="review-notice"><span className="eyebrow">Review held</span><h3>Review before execution.</h3><p>The amount is within policy, but it is above the automatic threshold. The action remains paused for agent review.</p><span className="mono">NO EXECUTION RECEIPT GENERATED</span></section>}{group && <CometChatErrorBoundary><CometChatProvider theme="dark"><CourtPanel key={run.runId} run={run} group={group} onUpdate={updateRun} /></CometChatProvider></CometChatErrorBoundary>}{run.receipt && !error && <><ReceiptCard receipt={run.receipt} /><CounterfactualCard run={run} /></>}</div></div></section>}
      <footer className="site-footer"><span>AGENT COURT</span><p>An agent proposes. Evidence challenges. A human decides.</p><span className="mono">BUILT WITH COMETCHAT SKILLS</span></footer>
    </main>
  </div>;
}


