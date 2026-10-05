export default function RiskBadge({ level }: { level: "LOW" | "MEDIUM" | "HIGH" }) {
  return <span className={`risk-badge risk-${level.toLowerCase()}`}><span aria-hidden="true" />{level} RISK</span>;
}
