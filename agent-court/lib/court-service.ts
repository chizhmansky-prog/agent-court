import "server-only";
import type { NextRequest } from "next/server";
import { CourtError, CourtRuntime, isMessageId, type CourtMessage, type CourtRun } from "./court-runtime";
import { cometchatRest, DEMO_ACTORS, HUMAN_UID, IntegrationError, verifyGroupMembers } from "./cometchat-server";
import { gateResponse, requireIntegrationSession, SESSION_COOKIE } from "./integration-service";

const store = globalThis as typeof globalThis & { agentCourtRuntimeV1?: CourtRuntime };
// This store is intentionally process-local. Deploy with one persistent Node
// process; a stateless/multi-instance platform cannot provide replay safety.
const court = store.agentCourtRuntimeV1 ??= new CourtRuntime({
  provider: {
    async createGroup(guid, item, runId, risk) {
      const group = await cometchatRest<{ guid: string; type: string }>("/groups", "POST", {
        guid, name: `CASE #${item.orderId.split("-")[1]} — Refund €${item.requestedAmount}`,
        type: "private", owner: HUMAN_UID,
        metadata: { purpose: "agent-court", runId, caseId: item.caseId, risk: risk.level, policyId: risk.policyId },
        members: { admins: [HUMAN_UID], participants: DEMO_ACTORS.slice(1).map(actor => actor.uid) },
      });
      if (group.guid !== guid || group.type !== "private") throw new CourtError("GROUP_CREATE_READBACK_INVALID");
    },
    async verifyMembers(guid) {
      return (await verifyGroupMembers(guid)).members.map(member => member.uid);
    },
    async send(guid, actor, text, metadata) {
      return cometchatRest<CourtMessage>("/messages", "POST", {
        receiver: guid, receiverType: "group", category: "message", type: "text", data: { text, metadata },
      }, actor);
    },
    async readMessage(id) {
      return cometchatRest<CourtMessage>(`/messages/${id}`, "GET", undefined, HUMAN_UID);
    },
  },
  async execute(input) {
    // No payment API, database, webhook or financial side effect exists here.
    // Validation is repeated at the simulation boundary, never repaired/coerced.
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new CourtError("INVALID_SIMULATED_AMOUNT");
  },
});

export async function readCourtBody(request: NextRequest, keys: readonly string[]): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > 4096) throw new CourtError("REQUEST_TOO_LARGE", 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new CourtError("INVALID_JSON", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CourtError("INVALID_REQUEST_BODY", 400);
  const result = body as Record<string, unknown>;
  if (Object.keys(result).length !== keys.length || keys.some(key => !Object.hasOwn(result, key)) || Object.keys(result).some(key => !keys.includes(key))) throw new CourtError("INVALID_REQUEST_FIELDS", 400);
  return result;
}

function requestSession(request: NextRequest): string {
  requireIntegrationSession(request);
  return request.cookies.get(SESSION_COOKIE)!.value;
}
function runReference(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9-]{1,64}$/.test(value)) throw new CourtError("INVALID_RUN_REFERENCE", 400);
  return value;
}
export async function startCourt(request: NextRequest): Promise<CourtRun> {
  const session = requestSession(request);
  const body = await readCourtBody(request, ["caseId"]);
  if (typeof body.caseId !== "string") throw new CourtError("INVALID_CASE_REFERENCE", 400);
  return court.start(body.caseId, session);
}
export async function courtStatus(request: NextRequest): Promise<CourtRun> {
  const session = requestSession(request);
  const body = await readCourtBody(request, ["runId"]);
  return court.status(runReference(body.runId), session);
}
export async function refundFromCourt(request: NextRequest): Promise<CourtRun> {
  const session = requestSession(request);
  const body = await readCourtBody(request, ["runId", "decisionMessageId"]);
  if (!isMessageId(body.decisionMessageId)) throw new CourtError("INVALID_MESSAGE_REFERENCE", 400);
  return court.decide(runReference(body.runId), body.decisionMessageId, session);
}
export function courtApiError(error: unknown) {
  if (error instanceof CourtError || error instanceof IntegrationError) return gateResponse({ error: error.code }, error.status);
  return gateResponse({ error: "COURT_REQUEST_FAILED" }, 502);
}
