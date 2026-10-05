import type { CourtRun } from "@/lib/court-runtime";
import { euros } from "./ActionCard";
export default function ReceiptCard({ receipt }: { receipt: NonNullable<CourtRun["receipt"]> }) {
  const rejected = receipt.executedAmount === 0 && receipt.decision === "REJECTED";
  return <section className="receipt-card" data-testid="execution-receipt">
    <div className="receipt-heading"><span className="eyebrow">Execution receipt</span><span className="receipt-seal" aria-hidden="true">✓</span></div>
    <h2>{rejected ? "The action was rejected." : "The action has a record."}</h2>
    <p className="receipt-context">{receipt.humanDecisionMessageId ? "Human decision read back from CometChat. The simulated action is recorded below." : "Within-policy action completed automatically. No court was opened."}</p>
    <dl className="receipt-amounts"><div><dt>Requested</dt><dd>{euros(receipt.requestedAmount)}</dd></div><div><dt>{rejected ? "Executed" : "Simulated execution"}</dt><dd>{euros(receipt.executedAmount)}</dd></div><div><dt>Prevented</dt><dd>{euros(receipt.preventedAmount)}</dd></div></dl>
    <div className="receipt-meta"><span>SIMULATED · NO MONEY MOVED</span><span>{receipt.receiptId}</span><span>DECISION: {receipt.decision}</span><span>{rejected ? "DECIDED BY" : "APPROVED BY"}: {receipt.approvedBy}</span>{receipt.humanDecisionMessageId && <span>HUMAN MESSAGE #{receipt.humanDecisionMessageId}</span>}<span>{receipt.policyId}</span></div>
  </section>;
}

