import type { CourtRun } from "@/lib/court-runtime";
import { euros } from "./ActionCard";
export default function CounterfactualCard({ run }: { run: CourtRun }) {
  if (!run.receipt || run.risk.level !== "HIGH") return null;
  return <section className="counterfactual" aria-label="Simulated counterfactual">
    <span className="eyebrow">The difference a decision makes</span>
    <div className="counterfactual-comparison"><div><span className="mono">WITHOUT THE COURT</span><strong>{euros(run.requestedAmount)}</strong><p>Would be executed in the simulated unchecked flow.</p><span className="violation">Policy violation</span></div><span className="counterfactual-arrow" aria-hidden="true">→</span><div><span className="mono">WITH AGENT COURT</span><strong>{euros(run.receipt.executedAmount)}</strong><p>{run.receipt.decision === "REJECTED" ? "Blocked by the recorded human decision." : "Executed after the recorded human decision."}</p><span className="protected">{euros(run.receipt.preventedAmount)} prevented</span></div></div>
    <p className="counterfactual-note">Policy-violating amount prevented in this simulated case.</p>
  </section>;
}

