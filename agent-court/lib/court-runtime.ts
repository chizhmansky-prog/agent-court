import { getDemoCase, type RefundCase } from "./demo-cases";
import { COURT_ACTORS, courtTranscript, parseHumanDecision, type AgentActor } from "./court-protocol";
import { eurosToCents, formatEuroCents } from "./policies";
import { evaluateRisk, type RiskDecision } from "./risk-engine";

export type CourtStatus = "COURT_CREATING" | "WAITING_HUMAN" | "EXECUTING" | "CLOSED" | "REVIEW" | "BLOCKED" | "FAILED_EXECUTION";
export type ExecutionReceipt = {
  receiptId: string; caseId: string; orderId: string; requestedAmount: number; executedAmount: number; preventedAmount: number;
  decision: "APPROVED" | "MODIFIED" | "REJECTED";
  approvedBy: string; policyId: string; riskLevel: RiskDecision["level"];
  courtGuid?: string; humanDecisionMessageId?: string; executedAt: string; simulated: true;
};
export type CourtRun = RefundCase & {
  runId: string; risk: RiskDecision; status: CourtStatus; courtGuid?: string;
  receipt?: ExecutionReceipt; error?: string;
};
export type CourtMessage = {
  id: string; sender: string; receiver: string; receiverType: string;
  category: string; type: string; sentAt?: number; updatedAt?: number;
  editedAt?: number; deletedAt?: number;
  data: { text?: string; metadata?: Record<string, unknown> };
};
export type CourtProvider = {
  createGroup(guid: string, item: RefundCase, runId: string, risk: RiskDecision): Promise<void>;
  verifyMembers(guid: string): Promise<readonly string[]>;
  send(guid: string, actor: AgentActor, text: string, metadata: Record<string, unknown>): Promise<CourtMessage>;
  readMessage(id: string): Promise<CourtMessage>;
};
export type SimulatedExecution = {
  runId: string; caseId: string; orderId: string; amountCents: number; decisionMessageId?: string;
};
export type CourtDependencies = {
  provider: CourtProvider;
  execute(input: SimulatedExecution): Promise<void>;
  now?: () => number;
  randomId?: () => string;
  delay?: (ms: number) => Promise<void>;
  maxRuns?: number;
};
export class CourtError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}
export const MAX_COURT_RUNS = 100;
export const DECISION_LIFETIME_MS = 15 * 60 * 1000;
export function isMessageId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d{0,23}$/.test(value);
}
type StoredRun = {
  run: CourtRun; ownerSession: string; createdAt: number; waitingAt?: number;
  evidenceIds: string[]; evidenceSentAt: number; decisionId?: string; queue: Promise<void>;
};

/** In-memory demonstration only. One Node process owns all run/decision state.
 * Never evict old runs to make room: losing a tombstone would permit replay.
 * Restart loses all run IDs; unknown IDs are 410 and cannot resume execution.
 */
export class CourtRuntime {
  private readonly runs = new Map<string, StoredRun>();
  private readonly now: () => number;
  private readonly randomId: () => string;
  private readonly delay: (ms: number) => Promise<void>;
  private readonly maxRuns: number;
  constructor(private readonly deps: CourtDependencies) {
    this.now = deps.now ?? Date.now;
    this.randomId = deps.randomId ?? (() => crypto.randomUUID());
    this.delay = deps.delay ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
    this.maxRuns = deps.maxRuns ?? MAX_COURT_RUNS;
    if (!Number.isInteger(this.maxRuns) || this.maxRuns < 1 || this.maxRuns > MAX_COURT_RUNS) throw new CourtError("INVALID_RUN_CAPACITY", 500);
  }
  private owned(runId: string, session: string): StoredRun {
    const record = this.runs.get(runId);
    if (!record) throw new CourtError("RUN_GONE_RESTART_REQUIRED", 410);
    if (!session || session !== record.ownerSession) throw new CourtError("RUN_SESSION_MISMATCH", 403);
    return record;
  }
  private snapshot(record: StoredRun): CourtRun { return structuredClone(record.run); }
  status(runId: string, session: string): CourtRun { return this.snapshot(this.owned(runId, session)); }

  async start(caseId: string, session: string): Promise<CourtRun> {
    const item = getDemoCase(caseId);
    if (!item) throw new CourtError("UNKNOWN_DEMO_CASE", 400);
    if (!session) throw new CourtError("DEMO_SESSION_REQUIRED", 401);
    if (this.runs.size >= this.maxRuns) throw new CourtError("RUN_CAPACITY_REACHED", 503);
    const runId = this.randomId();
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(runId) || this.runs.has(runId)) throw new CourtError("RUN_ID_COLLISION", 409);
    const risk = evaluateRisk(item);
    const record: StoredRun = {
      run: { ...item, runId, risk, status: risk.level === "MEDIUM" ? "REVIEW" : risk.level === "LOW" ? "EXECUTING" : "COURT_CREATING" },
      ownerSession: session, createdAt: this.now(), evidenceIds: [], evidenceSentAt: 0, queue: Promise.resolve(),
    };
    // Synchronous reservation precedes every await, including low-risk execution.
    this.runs.set(runId, record);
    if (risk.level === "MEDIUM") return this.snapshot(record);
    if (risk.level === "LOW") {
      await this.finish(record, eurosToCents(item.requestedAmount), "APPROVED", "policy_engine");
      return this.snapshot(record);
    }
    const guid = `court-${item.orderId.toLowerCase()}-${runId.toLowerCase()}`;
    record.run.courtGuid = guid;
    try {
      await this.deps.provider.createGroup(guid, item, runId, risk);
      const members = await this.deps.provider.verifyMembers(guid);
      if (members.length !== COURT_ACTORS.length || new Set(members).size !== COURT_ACTORS.length || COURT_ACTORS.some(uid => !members.includes(uid))) throw new CourtError("GROUP_MEMBERSHIP_INVALID");
      const transcript = courtTranscript(item, risk);
      for (let index = 0; index < transcript.length; index++) {
        if (index) await this.delay(800);
        const entry = transcript[index];
        const metadata = { runId, caseId: item.caseId, courtType: entry.courtType, policyId: risk.policyId };
        const sent = await this.deps.provider.send(guid, entry.actor, entry.text, metadata);
        if (!isMessageId(sent.id)) throw new CourtError("EVIDENCE_SEND_INVALID");
        const readback = await this.deps.provider.readMessage(sent.id);
        this.verifyMessage(readback, sent.id, guid, entry.actor);
        if (readback.data.text !== entry.text || readback.data.metadata?.runId !== runId || readback.data.metadata?.courtType !== entry.courtType) throw new CourtError("EVIDENCE_READBACK_INVALID");
        if (readback.sentAt! < Math.floor(record.createdAt / 1000) || readback.sentAt! < record.evidenceSentAt) throw new CourtError("EVIDENCE_FRESHNESS_INVALID");
        if (record.evidenceIds.some(id => BigInt(sent.id) <= BigInt(id))) throw new CourtError("EVIDENCE_ORDER_INVALID");
        record.evidenceIds.push(sent.id);
        record.evidenceSentAt = Math.max(record.evidenceSentAt, readback.sentAt!);
      }
      record.waitingAt = this.now();
      record.run.status = "WAITING_HUMAN";
    } catch {
      record.run.status = "BLOCKED";
      record.run.error = "COURT_SETUP_FAILED_ACTION_BLOCKED";
    }
    return this.snapshot(record);
  }

  async decide(runId: string, decisionMessageId: string, session: string): Promise<CourtRun> {
    const record = this.owned(runId, session);
    if (!isMessageId(decisionMessageId)) throw new CourtError("INVALID_MESSAGE_REFERENCE", 400);
    // Queue serializes provider readbacks too. The immutable decision is committed
    // synchronously before execution, so simultaneous conflicting IDs cannot win.
    const result = record.queue.then(() => this.decideLocked(record, decisionMessageId));
    record.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async decideLocked(record: StoredRun, id: string): Promise<CourtRun> {
    if (record.decisionId) {
      if (record.decisionId !== id) throw new CourtError("DECISION_ALREADY_COMMITTED");
      return this.snapshot(record); // Includes FAILED_EXECUTION; never reruns.
    }
    const run = record.run;
    if (run.risk.level !== "HIGH" || run.status !== "WAITING_HUMAN" || !run.courtGuid || record.evidenceIds.length !== 3) throw new CourtError("RUN_NOT_WAITING_FOR_HUMAN");
    if (this.now() - record.createdAt > DECISION_LIFETIME_MS) {
      run.status = "BLOCKED"; run.error = "RUN_EXPIRED_ACTION_BLOCKED";
      return this.snapshot(record);
    }
    let message: CourtMessage;
    try { message = await this.deps.provider.readMessage(id); }
    catch { run.error = "DECISION_READBACK_FAILED"; return this.snapshot(record); }
    // Provider latency must not extend the authorization window.
    if (this.now() - record.createdAt > DECISION_LIFETIME_MS) {
      run.status = "BLOCKED"; run.error = "RUN_EXPIRED_ACTION_BLOCKED";
      return this.snapshot(record);
    }
    try {
      this.verifyMessage(message, id, run.courtGuid, "human_judge");
      const latestEvidenceId = record.evidenceIds.at(-1)!;
      if (BigInt(id) <= BigInt(latestEvidenceId) || message.sentAt! < record.evidenceSentAt || message.sentAt! < Math.floor(record.waitingAt! / 1000) || this.now() - message.sentAt! * 1000 > DECISION_LIFETIME_MS) throw new CourtError("STALE_DECISION");
    } catch { run.error = "DECISION_AUTHORITY_INVALID"; return this.snapshot(record); }
    const parsed = parseHumanDecision(message.data.text);
    if (!parsed) { run.error = "INVALID_DECISION_USE_APPROVE_OR_REJECT"; return this.snapshot(record); }
    if (parsed.kind === "APPROVE" && parsed.amountCents > eurosToCents(run.risk.policyMaximum)) {
      run.error = "POLICY_MAXIMUM_EXCEEDED"; return this.snapshot(record);
    }
    delete run.error;
    record.decisionId = id;
    run.status = parsed.kind === "REJECT" ? "BLOCKED" : "EXECUTING";
    const amount = parsed.kind === "REJECT" ? 0 : parsed.amountCents;
    const decision = parsed.kind === "REJECT" ? "REJECTED" : amount === eurosToCents(run.requestedAmount) ? "APPROVED" : "MODIFIED";
    await this.finish(record, amount, decision, "human_judge", id);
    return this.snapshot(record);
  }

  private verifyMessage(message: CourtMessage, id: string, guid: string, sender: string) {
    if (!message || String(message.id) !== id || message.sender !== sender || message.receiver !== guid || message.receiverType !== "group" || message.category !== "message" || message.type !== "text" || message.editedAt || message.deletedAt || !message.data || typeof message.data.text !== "string" || !Number.isInteger(message.sentAt) || message.sentAt! < 1 || message.sentAt! * 1000 > this.now() + 5000 || (message.updatedAt !== undefined && message.updatedAt > message.sentAt!)) {
      throw new CourtError("MESSAGE_PROVENANCE_INVALID");
    }
  }

  private async finish(record: StoredRun, amountCents: number, decision: ExecutionReceipt["decision"], approvedBy: string, decisionMessageId?: string) {
    const run = record.run;
    try {
      if (decision !== "REJECTED") await this.deps.execute({ runId: run.runId, caseId: run.caseId, orderId: run.orderId, amountCents, decisionMessageId });
      const receipt: ExecutionReceipt = {
        receiptId: `rcpt_${this.randomId()}`, caseId: run.caseId, orderId: run.orderId, requestedAmount: run.requestedAmount,
        executedAmount: amountCents / 100, preventedAmount: (eurosToCents(run.requestedAmount) - amountCents) / 100,
        decision, approvedBy, policyId: run.risk.policyId, riskLevel: run.risk.level,
        ...(run.courtGuid ? { courtGuid: run.courtGuid } : {}),
        ...(decisionMessageId ? { humanDecisionMessageId: decisionMessageId } : {}),
        executedAt: new Date(this.now()).toISOString(), simulated: true,
      };
      if (run.courtGuid) {
        const text = decision === "REJECTED" ? "ACTION BLOCKED — Human rejected the proposed refund. No simulated refund executed." : `ACTION EXECUTED — ${formatEuroCents(amountCents)} (simulated refund). Receipt: ${receipt.receiptId}`;
        const sent = await this.deps.provider.send(run.courtGuid, "executor_agent", text, { runId: run.runId, caseId: run.caseId, courtType: "receipt", decisionMessageId, receiptId: receipt.receiptId, simulated: true });
        if (!isMessageId(sent.id)) throw new CourtError("RECEIPT_MESSAGE_INVALID");
        const readback = await this.deps.provider.readMessage(sent.id);
        this.verifyMessage(readback, sent.id, run.courtGuid, "executor_agent");
        if (readback.data.text !== text || readback.data.metadata?.receiptId !== receipt.receiptId) throw new CourtError("RECEIPT_READBACK_INVALID");
      }
      run.receipt = receipt;
      run.status = "CLOSED";
    } catch {
      // Even if simulation ran before the acknowledgement failed, never retry.
      run.status = "FAILED_EXECUTION";
      run.error = "EXECUTION_OR_RECEIPT_FAILED_NO_RETRY";
      delete run.receipt;
    }
  }
}
