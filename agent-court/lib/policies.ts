export const REFUND_POLICY = Object.freeze({
  id: "REFUND_AFTER_48H_MAX_50",
  cutoffHours: 48,
  retainedPercent: 50,
  text: "After 48 hours, the maximum refund is 50% of the paid amount.",
});

export function eurosToCents(amount: number): number {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(cents) || Math.abs(cents / 100 - amount) > 1e-8) {
    throw new Error("INVALID_MONEY");
  }
  return cents;
}

export function refundMaximumCents(paidCents: number, orderAgeHours: number): number {
  if (!Number.isSafeInteger(paidCents) || paidCents < 0 || !Number.isFinite(orderAgeHours) || orderAgeHours < 0) throw new Error("INVALID_CASE");
  return orderAgeHours <= REFUND_POLICY.cutoffHours ? paidCents : Math.floor(paidCents * REFUND_POLICY.retainedPercent / 100);
}

export function formatEuroCents(cents: number): string {
  return `€${Number.isInteger(cents / 100) ? cents / 100 : (cents / 100).toFixed(2)}`;
}
