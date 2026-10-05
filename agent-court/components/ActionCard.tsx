import RiskBadge from "./RiskBadge";
export const euros = (amount: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(amount);
type Props = { caseId: string; amount: number; age: number; level: "LOW" | "MEDIUM" | "HIGH"; index: string; active: boolean; disabled: boolean; onRun: () => void };
export default function ActionCard({ caseId, amount, age, level, index, active, disabled, onRun }: Props) {
  return <article className={`action-card ${level === "HIGH" ? "action-card-featured" : ""} ${active ? "action-card-active" : ""}`}>
    <div className="action-card-top"><span className="mono">CASE {index} / {caseId}</span><RiskBadge level={level} /></div>
    <h3>Refund <span>{euros(amount)}</span></h3>
    <p className="action-card-detail">Customer cancellation · {age} hours after payment</p>
    <div className="action-route"><span>{level === "LOW" ? "Within policy" : level === "MEDIUM" ? "Agent review required" : "Exceeds the policy limit"}</span><span aria-hidden="true">↗</span></div>
    <button className={level === "HIGH" ? "button button-primary" : "button button-outline"} onClick={onRun} disabled={disabled}>{active && disabled ? "Preparing case…" : level === "HIGH" ? "Convene court" : "Run agent"}<span aria-hidden="true">→</span></button>
  </article>;
}

