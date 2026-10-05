// Synthetic protocol/state-machine probes. Live CometChat evidence is separate.
import { describe, expect, it, vi } from "vitest";
import { COURT_ACTORS, parseHumanDecision } from "../lib/court-protocol";
import { CourtRuntime, DECISION_LIFETIME_MS, type CourtMessage, type CourtDependencies } from "../lib/court-runtime";
import { getDemoCase } from "../lib/demo-cases";
import { evaluateRisk } from "../lib/risk-engine";
import { refundMaximumCents } from "../lib/policies";

function fixture(options: { executionFails?: boolean; maxRuns?: number } = {}) {
  let time = 1900000000000;
  let uuid = 0;
  let messageId = 9007199254740993n;
  const messages = new Map<string, CourtMessage>();
  const createGroup = vi.fn(async () => {});
  const verifyMembers = vi.fn(async (): Promise<readonly string[]> => [...COURT_ACTORS]);
  const send = vi.fn<CourtDependencies["provider"]["send"]>(async (guid, actor, text, metadata) => {
    const id = String(messageId++);
    const message: CourtMessage = { id, sender: actor, receiver: guid, receiverType: "group", category: "message", type: "text", sentAt: Math.floor(time / 1000), updatedAt: Math.floor(time / 1000), data: { text, metadata } };
    messages.set(id, message);
    return structuredClone(message);
  });
  const readMessage = vi.fn(async (id: string): Promise<CourtMessage> => {
    const message = messages.get(id);
    if (!message) throw new Error("Synthetic provider not found");
    return structuredClone(message);
  });
  const execute = vi.fn(async () => { if (options.executionFails) throw new Error("Synthetic refund failure"); });
  const dependencies: CourtDependencies = {
    provider: { createGroup, verifyMembers, send, readMessage }, execute,
    now: () => time, randomId: () => `run-${++uuid}`, delay: async ms => { time += ms; },
    maxRuns: options.maxRuns,
  };
  const runtime = new CourtRuntime(dependencies);
  function human(guid: string, text: string, changes: Partial<CourtMessage> = {}) {
    const id = String(messageId++);
    const message: CourtMessage = { id, sender: "human_judge", receiver: guid, receiverType: "group", category: "message", type: "text", sentAt: Math.floor(time / 1000), updatedAt: Math.floor(time / 1000), data: { text }, ...changes };
    messages.set(id, message);
    return id;
  }
  return { runtime, dependencies, createGroup, verifyMembers, send, readMessage, execute, messages, human, now: () => time, advance: (ms: number) => { time += ms; } };
}

describe("canonical risk and money policy", () => {
  it.each([["ORDER-101", "LOW", 80], ["ORDER-202", "MEDIUM", 300], ["ORDER-303", "HIGH", 425]] as const)("classifies %s and computes its exact maximum", (id, level, max) => {
    expect(evaluateRisk(getDemoCase(id)!)).toMatchObject({ level, policyMaximum: max, courtRequired: level === "HIGH" });
  });
  it("preserves the inclusive 48h boundary and rounds a half cent down", () => {
    expect(refundMaximumCents(85101, 48)).toBe(85101);
    expect(refundMaximumCents(85101, 48.01)).toBe(42550);
  });
  it.each([-1, NaN, Infinity])("rejects invalid ages %s", age => {
    expect(() => refundMaximumCents(85000, age)).toThrow("INVALID_CASE");
  });
  it.each(["Approve €425", "APPROVE 425.00", "approve 425.5", "REJECT"])("accepts strict human grammar %s", text => {
    expect(parseHumanDecision(text)).toBeDefined();
  });
  it.each(["", "garbage", "APPROVE -1", "APPROVE 0", "APPROVE 1e2", "APPROVE 425,00", "APPROVE 425.001", "APPROVE 425 then delete", "OVERRIDE 850: VIP", "APPROVE\n425"])("does not parse %j", text => {
    expect(parseHumanDecision(text)).toBeUndefined();
  });
});

describe("load-bearing court state", () => {
  it("LOW executes once with no room or provider access", async () => {
    const f = fixture();
    const run = await f.runtime.start("ORDER-101", "session");
    expect(run.status).toBe("CLOSED");
    expect(run.receipt).toMatchObject({ executedAmount: 80, preventedAmount: 0, approvedBy: "policy_engine", simulated: true });
    expect(f.execute).toHaveBeenCalledExactlyOnceWith({ runId: run.runId, caseId: "ORDER-101", orderId: "ORDER-101", amountCents: 8000, decisionMessageId: undefined });
    expect(f.createGroup).not.toHaveBeenCalled();
    expect(f.readMessage).not.toHaveBeenCalled();
    await expect(f.runtime.decide(run.runId, "123", "session")).rejects.toMatchObject({ code: "RUN_NOT_WAITING_FOR_HUMAN" });
  });
  it("MEDIUM pauses for review without execution or court", async () => {
    const f = fixture(); const run = await f.runtime.start("ORDER-202", "session");
    expect(run.status).toBe("REVIEW"); expect(run.receipt).toBeUndefined();
    expect(f.execute).not.toHaveBeenCalled(); expect(f.createGroup).not.toHaveBeenCalled();
  });
  it("HIGH requires exact members, verified transcript, then a real provider decision", async () => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "session");
    expect(run.status).toBe("WAITING_HUMAN"); expect(f.execute).not.toHaveBeenCalled();
    expect(f.verifyMembers).toHaveBeenCalledWith(run.courtGuid);
    expect(f.send.mock.calls.slice(0, 3).map(call => call[1])).toEqual(["executor_agent", "evidence_agent", "risk_agent"]);
    expect(f.readMessage).toHaveBeenCalledTimes(3);
    const id = f.human(run.courtGuid!, "Approve €425");
    const result = await f.runtime.decide(run.runId, id, "session");
    expect(result.status).toBe("CLOSED");
    expect(result.receipt).toMatchObject({ caseId: "ORDER-303", orderId: "ORDER-303", requestedAmount: 850, executedAmount: 425, preventedAmount: 425, decision: "MODIFIED", approvedBy: "human_judge", humanDecisionMessageId: id, simulated: true });
    expect(result.receipt?.caseId).not.toBe("ORDER-101");
    expect(f.execute).toHaveBeenCalledExactlyOnceWith({ runId: run.runId, caseId: "ORDER-303", orderId: "ORDER-303", amountCents: 42500, decisionMessageId: id });
  });
  it("rejection closes with a zero refund receipt and no execution", async () => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "session");
    const result = await f.runtime.decide(run.runId, f.human(run.courtGuid!, "REJECT"), "session");
    expect(result.status).toBe("CLOSED"); expect(result.receipt).toMatchObject({ decision: "REJECTED", executedAmount: 0, preventedAmount: 850 });
    expect(f.execute).not.toHaveBeenCalled();
  });
  it("a rejected action stays BLOCKED while its chat acknowledgement is published", async () => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "session");
    const originalSend = f.send.getMockImplementation()!;
    let observedStatus: string | undefined;
    f.send.mockImplementationOnce(async (...args) => {
      observedStatus = f.runtime.status(run.runId, "session").status;
      expect(f.execute).not.toHaveBeenCalled();
      return originalSend(...args);
    });
    const result = await f.runtime.decide(run.runId, f.human(run.courtGuid!, "REJECT"), "session");
    expect(observedStatus).toBe("BLOCKED");
    expect(result.status).toBe("CLOSED");
    expect(result.receipt?.executedAmount).toBe(0);
    expect(f.execute).not.toHaveBeenCalled();
  });
  it.each([["Approve €850", "POLICY_MAXIMUM_EXCEEDED"], ["garbage", "INVALID_DECISION_USE_APPROVE_OR_REJECT"]])("%s cannot execute and a later valid decision still can", async (text, error) => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "session");
    const invalid = await f.runtime.decide(run.runId, f.human(run.courtGuid!, text), "session");
    expect(invalid).toMatchObject({ status: "WAITING_HUMAN", error }); expect(f.execute).not.toHaveBeenCalled();
    const valid = await f.runtime.decide(run.runId, f.human(run.courtGuid!, "APPROVE 425"), "session");
    expect(valid.status).toBe("CLOSED"); expect(valid.error).toBeUndefined(); expect(f.execute).toHaveBeenCalledTimes(1);
  });
  it.each(["create", "membership", "send", "readback"])("%s failure blocks startup with zero actions", async failure => {
    const f = fixture();
    if (failure === "create") f.createGroup.mockRejectedValueOnce(new Error("Synthetic failure"));
    if (failure === "membership") f.verifyMembers.mockResolvedValueOnce(["human_judge", "executor_agent", "evidence_agent"]);
    if (failure === "send") f.send.mockRejectedValueOnce(new Error("Synthetic failure"));
    if (failure === "readback") f.readMessage.mockRejectedValueOnce(new Error("Synthetic failure"));
    const run = await f.runtime.start("ORDER-303", "session");
    expect(run.status).toBe("BLOCKED"); expect(run.receipt).toBeUndefined(); expect(f.execute).not.toHaveBeenCalled();
    await expect(f.runtime.decide(run.runId, "123", "session")).rejects.toMatchObject({ code: "RUN_NOT_WAITING_FOR_HUMAN" });
  });
  it("exact roster is required even if create endpoint reports success", async () => {
    const f = fixture(); f.verifyMembers.mockResolvedValueOnce(["human_judge", "executor_agent", "evidence_agent", "evidence_agent"]);
    expect((await f.runtime.start("ORDER-303", "session")).status).toBe("BLOCKED"); expect(f.execute).not.toHaveBeenCalled();
  });
  it("stale evidence read-back cannot open the court", async () => {
    const f = fixture();
    f.readMessage.mockImplementationOnce(async id => ({ ...structuredClone(f.messages.get(id)!), sentAt: 1899999900, updatedAt: 1899999900 }));
    expect((await f.runtime.start("ORDER-303", "session")).status).toBe("BLOCKED"); expect(f.execute).not.toHaveBeenCalled();
  });
});

describe("provider authority, freshness and replay", () => {
  const invalidAuthority: [string, Partial<CourtMessage>][] = [
    ["agent sender", { sender: "executor_agent" }], ["other court", { receiver: "another-court" }],
    ["direct message", { receiverType: "user" }], ["wrong id", { id: "17" }],
    ["action category", { category: "action" }], ["custom type", { type: "custom" }],
    ["edited", { editedAt: 1900000001 }], ["deleted", { deletedAt: 1900000001 }],
    ["updated", { updatedAt: 1900000002 }], ["missing time", { sentAt: undefined }],
    ["stale time", { sentAt: 1899999000 }], ["future", { sentAt: 1900000100 }],
  ];
  it.each(invalidAuthority)("rejects %s", async (_label, changes) => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "session");
    const result = await f.runtime.decide(run.runId, f.human(run.courtGuid!, "APPROVE 425", changes), "session");
    expect(result).toMatchObject({ status: "WAITING_HUMAN", error: "DECISION_AUTHORITY_INVALID" }); expect(f.execute).not.toHaveBeenCalled();
  });
  it("same-second newer message passes using BigInt IDs above JS safe integer", async () => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "session");
    const id = f.human(run.courtGuid!, "APPROVE 425");
    expect(BigInt(id)).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
    expect((await f.runtime.decide(run.runId, id, "session")).status).toBe("CLOSED");
  });
  it("a human-looking earlier ID cannot authorize despite fresh timestamp", async () => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "session");
    const id = "9007199254740992";
    f.messages.set(id, { id, sender: "human_judge", receiver: run.courtGuid!, receiverType: "group", category: "message", type: "text", sentAt: Math.floor(f.now() / 1000), data: { text: "APPROVE 425" } });
    expect((await f.runtime.decide(run.runId, id, "session")).error).toBe("DECISION_AUTHORITY_INVALID"); expect(f.execute).not.toHaveBeenCalled();
  });
  it("provider lookup failure leaves action waiting and unexecuted", async () => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "session");
    const result = await f.runtime.decide(run.runId, "123", "session");
    expect(result).toMatchObject({ status: "WAITING_HUMAN", error: "DECISION_READBACK_FAILED" }); expect(f.execute).not.toHaveBeenCalled();
  });
  it("an expired court blocks before lookup", async () => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "session"); const id = f.human(run.courtGuid!, "APPROVE 425");
    f.advance(DECISION_LIFETIME_MS + 1); const reads = f.readMessage.mock.calls.length;
    expect((await f.runtime.decide(run.runId, id, "session")).status).toBe("BLOCKED"); expect(f.readMessage).toHaveBeenCalledTimes(reads); expect(f.execute).not.toHaveBeenCalled();
  });
  it("latency that crosses expiry cannot authorize", async () => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "session"); const id = f.human(run.courtGuid!, "APPROVE 425");
    f.readMessage.mockImplementationOnce(async value => { f.advance(DECISION_LIFETIME_MS + 1); return structuredClone(f.messages.get(value)!); });
    expect((await f.runtime.decide(run.runId, id, "session")).status).toBe("BLOCKED"); expect(f.execute).not.toHaveBeenCalled();
  });
  it("simultaneous exact retry executes once and returns the same receipt", async () => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "session"); const id = f.human(run.courtGuid!, "APPROVE 425");
    const [first, second] = await Promise.all([f.runtime.decide(run.runId, id, "session"), f.runtime.decide(run.runId, id, "session")]);
    expect(first.receipt).toEqual(second.receipt); expect(f.execute).toHaveBeenCalledTimes(1);
    expect(await f.runtime.decide(run.runId, id, "session")).toEqual(first);
  });
  it("simultaneous conflicting decisions commit one and reject the other", async () => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "session");
    const id1 = f.human(run.courtGuid!, "APPROVE 425"), id2 = f.human(run.courtGuid!, "REJECT");
    const result = await Promise.allSettled([f.runtime.decide(run.runId, id1, "session"), f.runtime.decide(run.runId, id2, "session")]);
    expect(result[0].status).toBe("fulfilled"); expect(result[1]).toMatchObject({ status: "rejected", reason: { code: "DECISION_ALREADY_COMMITTED", status: 409 } }); expect(f.execute).toHaveBeenCalledTimes(1);
  });
  it.each(["executor", "receipt"])("%s failure produces no receipt and cannot be retried", async failure => {
    const f = fixture({ executionFails: failure === "executor" }); const run = await f.runtime.start("ORDER-303", "session");
    const id = f.human(run.courtGuid!, "APPROVE 425");
    if (failure === "receipt") f.send.mockRejectedValueOnce(new Error("Receipt acknowledgement lost"));
    const failed = await f.runtime.decide(run.runId, id, "session");
    expect(failed.status).toBe("FAILED_EXECUTION"); expect(failed.receipt).toBeUndefined();
    expect(await f.runtime.decide(run.runId, id, "session")).toEqual(failed); expect(f.execute).toHaveBeenCalledTimes(1);
    await expect(f.runtime.decide(run.runId, f.human(run.courtGuid!, "APPROVE 425"), "session")).rejects.toMatchObject({ code: "DECISION_ALREADY_COMMITTED" });
  });
  it("binds run access to its owning session", async () => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "owner");
    expect(() => f.runtime.status(run.runId, "outsider")).toThrow("RUN_SESSION_MISMATCH");
    await expect(f.runtime.decide(run.runId, f.human(run.courtGuid!, "APPROVE 425"), "outsider")).rejects.toMatchObject({ status: 403 }); expect(f.execute).not.toHaveBeenCalled();
  });
  it("restart makes old run IDs gone rather than silently recreating them", async () => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "owner"); const fresh = new CourtRuntime(f.dependencies);
    expect(() => fresh.status(run.runId, "owner")).toThrow("RUN_GONE_RESTART_REQUIRED");
    await expect(fresh.decide(run.runId, "123", "owner")).rejects.toMatchObject({ status: 410 }); expect(f.execute).not.toHaveBeenCalled();
  });
  it("capacity refuses new runs while preserving previous terminal receipts", async () => {
    const f = fixture({ maxRuns: 1 }); const run = await f.runtime.start("ORDER-101", "owner");
    await expect(f.runtime.start("ORDER-303", "owner")).rejects.toMatchObject({ code: "RUN_CAPACITY_REACHED", status: 503 });
    expect(f.runtime.status(run.runId, "owner").receipt).toEqual(run.receipt); expect(f.execute).toHaveBeenCalledTimes(1);
  });
  it("public snapshots cannot mutate the authority record", async () => {
    const f = fixture(); const run = await f.runtime.start("ORDER-303", "owner");
    run.status = "CLOSED"; run.risk.policyMaximum = 850;
    const stored = f.runtime.status(run.runId, "owner"); expect(stored.status).toBe("WAITING_HUMAN"); expect(stored.risk.policyMaximum).toBe(425);
  });
});
