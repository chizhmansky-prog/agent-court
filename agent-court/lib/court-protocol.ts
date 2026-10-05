import type { RefundCase } from "./demo-cases";
import { eurosToCents, formatEuroCents, REFUND_POLICY } from "./policies";
import type { RiskDecision } from "./risk-engine";

export const COURT_ACTORS = ["human_judge", "executor_agent", "evidence_agent", "risk_agent"] as const;
export type AgentActor = Exclude<typeof COURT_ACTORS[number], "human_judge">;
export type ParsedDecision = { kind: "APPROVE"; amountCents: number } | { kind: "REJECT" };

// Narrow grammar: no signs, exponent notation, commas, partial text, or override.
export function parseHumanDecision(text: unknown): ParsedDecision | undefined {
  if (typeof text !== "string" || text.length > 128) return undefined;
  const command = text.trim();
  if (/^REJECT$/i.test(command)) return { kind: "REJECT" };
  const match = /^APPROVE[ \t]+€?([0-9]{1,8})(?:\.([0-9]{1,2}))?$/i.exec(command);
  if (!match) return undefined;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) return undefined;
  return { kind: "APPROVE", amountCents: cents };
}

export function courtTranscript(item: RefundCase, risk: RiskDecision) {
  const requested = eurosToCents(item.requestedAmount);
  const maximum = eurosToCents(risk.policyMaximum);
  return [
    { actor: "executor_agent", courtType: "proposal", text: `[PROPOSAL]\nCase: ${item.orderId}\nRequested action: Refund ${formatEuroCents(requested)}\nReason: Customer cancellation request` },
    { actor: "evidence_agent", courtType: "evidence", text: `[EVIDENCE]\nPolicy ${REFUND_POLICY.id}:\n${REFUND_POLICY.text}\n\nOrder age: ${item.orderAgeHours}h\nPaid: ${formatEuroCents(eurosToCents(item.paidAmount))}\nMaximum allowed: ${formatEuroCents(maximum)}` },
    { actor: "risk_agent", courtType: "objection", text: `[OBJECTION]\nBLOCK ${formatEuroCents(requested)}.\n\nRequested amount exceeds policy maximum by ${formatEuroCents(requested - maximum)}.\nRecommended action: modify refund to ${formatEuroCents(maximum)}.` },
  ] satisfies { actor: AgentActor; courtType: string; text: string }[];
}
