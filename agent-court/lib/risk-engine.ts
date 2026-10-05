import type { RefundCase } from "./demo-cases";
import { eurosToCents, REFUND_POLICY, refundMaximumCents } from "./policies";

export type RiskDecision = {
  level: "LOW" | "MEDIUM" | "HIGH";
  requestedAmount: number;
  policyMaximum: number;
  courtRequired: boolean;
  policyId: string;
  reason: string;
};

export function evaluateRisk(item: RefundCase): RiskDecision {
  const paid = eurosToCents(item.paidAmount);
  const requested = eurosToCents(item.requestedAmount);
  if (requested <= 0) throw new Error("INVALID_CASE");
  const maximum = refundMaximumCents(paid, item.orderAgeHours);
  const level = requested > maximum ? "HIGH" : requested <= 10000 ? "LOW" : "MEDIUM";
  return {
    level, requestedAmount: requested / 100, policyMaximum: maximum / 100,
    courtRequired: level === "HIGH", policyId: REFUND_POLICY.id,
    reason: level === "HIGH" ? "Requested refund exceeds the verified policy maximum." : level === "MEDIUM" ? "Policy permits this amount; agent review is required above €100." : "Within policy and the €100 automatic execution threshold.",
  };
}
