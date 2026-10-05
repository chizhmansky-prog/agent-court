// Synthetic API authority probes; no real CometChat calls or refunds.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
import { POST as courtPost } from "../app/api/court/[operation]/route";
import { POST as refundPost } from "../app/api/refund/route";
import { attachIntegrationSession, gateResponse, SESSION_COOKIE } from "../lib/integration-service";
import type { CourtRun } from "../lib/court-runtime";

const origin = "http://127.0.0.1:3010";
const fetchMock = vi.fn<typeof fetch>();
function session() {
  const response = attachIntegrationSession(gateResponse({}), false);
  return `${SESSION_COOKIE}=${response.cookies.get(SESSION_COOKIE)!.value}`;
}
function request(path: string, body: string, cookie?: string, requestOrigin: string | null = origin) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers.cookie = cookie;
  if (requestOrigin) headers.origin = requestOrigin;
  return new NextRequest(`${origin}${path}`, { method: "POST", headers, body });
}
function court(operation: string, body: string, cookie?: string, requestOrigin: string | null = origin) {
  return courtPost(request(`/api/court/${operation}`, body, cookie, requestOrigin), { params: Promise.resolve({ operation }) });
}
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("APP_ORIGIN", ""); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("court API session/origin/authority boundaries", () => {
  it("starts LOW and returns its same immutable receipt on owner status lookup", async () => {
    const cookie = session();
    const started = await court("start", '{"caseId":"ORDER-101"}', cookie);
    expect(started.status).toBe(200); expect(started.headers.get("cache-control")).toBe("no-store");
    const run = await started.json() as CourtRun;
    expect(run).toMatchObject({ caseId: "ORDER-101", status: "CLOSED", receipt: { executedAmount: 80, simulated: true } });
    const status = await court("status", JSON.stringify({ runId: run.runId }), cookie);
    expect(await status.json()).toEqual(run); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("MEDIUM API starts paused without external calls", async () => {
    const response = await court("start", '{"caseId":"ORDER-202"}', session());
    expect(await response.json()).toMatchObject({ status: "REVIEW" }); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("a different valid demo session cannot view another run", async () => {
    const run = await (await court("start", '{"caseId":"ORDER-101"}', session())).json() as CourtRun;
    const response = await court("status", JSON.stringify({ runId: run.runId }), session());
    expect(response.status).toBe(403); expect(await response.json()).toEqual({ error: "RUN_SESSION_MISMATCH" });
  });
  it.each(["start", "status"])("%s requires a live session before processing fields", async operation => {
    const response = await court(operation, "{}");
    expect(response.status).toBe(401); expect(await response.json()).toEqual({ error: "DEMO_SESSION_REQUIRED" }); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("refund requires a session before provider lookup", async () => {
    const response = await refundPost(request("/api/refund", '{"runId":"unknown","decisionMessageId":"123"}'));
    expect(response.status).toBe(401); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([null, "https://attacker.example"])("origin %j cannot start or decide", async requestOrigin => {
    const cookie = session();
    const start = await court("start", '{"caseId":"ORDER-101"}', cookie, requestOrigin);
    const refund = await refundPost(request("/api/refund", '{"runId":"unknown","decisionMessageId":"123"}', cookie, requestOrigin));
    expect(start.status).toBe(403); expect(refund.status).toBe(403); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["null", "[]", "42", '"case"', "{}", '{"caseId":"ORDER-101","amount":850}', '{"caseId":"ORDER-101","actor":"human_judge"}'])("cannot start from unsupported input %s", async body => {
    const response = await court("start", body, session()); expect(response.status).toBe(400); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("invalid JSON returns a safe 400", async () => {
    const response = await court("start", "invalid-json", session()); expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: "INVALID_JSON" });
  });
  it("an unknown case cannot construct arbitrary refund inputs", async () => {
    const response = await court("start", '{"caseId":"attacker-order"}', session());
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: "UNKNOWN_DEMO_CASE" }); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["123", "../42", "0", "1e2"])("refund message ID %j cannot authorize with a tampered run reference or numeric ID type", async id => {
    const response = await refundPost(request("/api/refund", JSON.stringify({ runId: "../unknown", decisionMessageId: id }), session()));
    expect(response.status).toBe(400); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("refund does not accept a numeric JS message ID", async () => {
    const response = await refundPost(request("/api/refund", '{"runId":"unknown","decisionMessageId":123}', session()));
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: "INVALID_MESSAGE_REFERENCE" }); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["amount", "actor", "text", "caseId"])("caller %s cannot supplement a decision ID as authority", async field => {
    const response = await refundPost(request("/api/refund", JSON.stringify({ runId: "unknown", decisionMessageId: "123", [field]: "forged" }), session()));
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: "INVALID_REQUEST_FIELDS" }); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("unknown run references fail 410 without replay/recreation", async () => {
    const response = await refundPost(request("/api/refund", '{"runId":"gone-run","decisionMessageId":"123"}', session()));
    expect(response.status).toBe(410); expect(await response.json()).toEqual({ error: "RUN_GONE_RESTART_REQUIRED" }); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("oversized actual bodies are refused even without content-length", async () => {
    const response = await court("start", JSON.stringify({ caseId: "A".repeat(5000) }), session());
    expect(response.status).toBe(413); expect(await response.json()).toEqual({ error: "REQUEST_TOO_LARGE" }); expect(fetchMock).not.toHaveBeenCalled();
  });
});
