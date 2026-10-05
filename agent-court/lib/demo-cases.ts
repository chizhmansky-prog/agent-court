export type RefundCase = {
  caseId: string;
  orderId: string;
  paidAmount: number;
  requestedAmount: number;
  orderAgeHours: number;
};

export const DEMO_CASES = Object.freeze([
  Object.freeze({ caseId: "ORDER-101", orderId: "ORDER-101", paidAmount: 80, requestedAmount: 80, orderAgeHours: 12 }),
  Object.freeze({ caseId: "ORDER-202", orderId: "ORDER-202", paidAmount: 300, requestedAmount: 300, orderAgeHours: 36 }),
  Object.freeze({ caseId: "ORDER-303", orderId: "ORDER-303", paidAmount: 850, requestedAmount: 850, orderAgeHours: 72 }),
] satisfies RefundCase[]);

export function getDemoCase(caseId: string): RefundCase | undefined {
  const item = DEMO_CASES.find(item => item.caseId === caseId);
  return item ? { ...item } : undefined;
}
