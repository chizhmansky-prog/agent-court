import type { CourtRun } from "@/lib/court-runtime";

export default function GateDiagram({ run }: { run: CourtRun | null }) {
  const waiting = run?.status === "WAITING_HUMAN";
  const state = run ? `${run.orderId} / ${run.status.replaceAll("_", " ")}` : "HIGH RISK PATH / WORKFLOW SCHEMATIC";
  return <div className={`gate-diagram ${waiting ? "gate-diagram-waiting" : ""}`}>
    <div className="diagram-heading"><span className="mono">EXECUTION CONTROL</span><span className="diagram-marker" aria-hidden="true">↗</span></div>
    <svg viewBox="0 0 500 350" role="img" aria-labelledby="gate-diagram-title gate-diagram-description">
      <title id="gate-diagram-title">The Agent Court decision gate</title><desc id="gate-diagram-description">A proposed action goes through policy evidence and a risk objection before a human decision opens the execution gate. {state}.</desc>
      <defs><pattern id="court-grid" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#414649" /></pattern><marker id="court-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7" fill="none" stroke="#62686c" /></marker></defs>
      <rect width="500" height="350" fill="url(#court-grid)" />
      <path d="M125 80H210V128M125 80H360V128M265 184V230M415 184V230H265" className="diagram-wire" markerEnd="url(#court-arrow)" />
      <path d="M100 80V268H220M390 268H465" className="diagram-bypass" />
      <rect x="27" y="30" width="147" height="88" rx="6" className="diagram-node" /><path d="M45 51H61M45 58H56M45 65H61" stroke="#b8ff45" strokeWidth="2" />
      <text x="73" y="60" className="diagram-label">PROPOSED ACTION</text><text x="45" y="95" className="diagram-amount">{run ? `€${run.requestedAmount}` : "€850"}</text>
      <rect x="191" y="128" width="147" height="58" rx="6" className="diagram-node" /><rect x="204" y="143" width="16" height="22" rx="2" fill="none" stroke="#969fa4" /><path d="M208 150H216M208 155H216" stroke="#969fa4" /><text x="231" y="151" className="diagram-label">EVIDENCE</text><text x="231" y="170" className="diagram-detail">Verified policy</text>
      <rect x="354" y="128" width="120" height="58" rx="6" className="diagram-node diagram-node-risk" /><text x="369" y="151" className="diagram-label">OBJECTION</text><text x="369" y="170" className="diagram-detail">Risk challenge</text>
      <rect x="219" y="230" width="173" height="78" rx="6" className="diagram-human" /><path d="M235 258V249a8 8 0 0 1 16 0v9M232 258H254V275H232Z" fill="none" stroke="#b8ff45" strokeWidth="1.7" /><text x="269" y="257" className="diagram-label">HUMAN DECISION</text><text x="269" y="280" className="diagram-detail">{run?.risk.level === "LOW" ? "Not required for LOW" : waiting ? "Awaiting approval" : run?.receipt?.humanDecisionMessageId ? "Recorded in chat" : "Approve or reject"}</text>
      <path d="M461 257V279M467 257V279" stroke="#b8ff45" strokeWidth="2" /><text x="30" y="321" className="diagram-footnote">NO HUMAN DECISION → NO HIGH-RISK EXECUTION</text>
    </svg>
    <div className="diagram-state mono"><span />{state}</div>
  </div>;
}
