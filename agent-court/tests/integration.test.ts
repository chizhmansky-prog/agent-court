// Synthetic regression probes only. Provider responses are mocked; these do
// not certify live CometChat login, realtime delivery, or Gate 0 completion.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

import {
  DEMO_ACTORS, HUMAN_UID, INTEGRATION_GUID, integrationAgentPing,
  mintHumanToken, verifyGroupMembers, verifyIntegrationMessage,
  type RestMessage,
} from "@/lib/cometchat-server";
import {
  attachIntegrationSession, gateResponse, requireSameOrigin, SESSION_COOKIE,
} from "@/lib/integration-service";
import { POST as integrationPost } from "@/app/api/integration/[operation]/route";
import { POST as tokenPost } from "@/app/api/cometchat/token/route";

const LOCAL_ORIGIN = "http://127.0.0.1:3010";
const fetchMock = vi.fn<typeof fetch>();
const roster = DEMO_ACTORS.map(actor => ({ ...actor }));
const privateGroup = { guid: INTEGRATION_GUID, type: "private" };
const humanMessage: RestMessage = {
  id: "1234", sender: HUMAN_UID, receiver: INTEGRATION_GUID,
  receiverType: "group", category: "message", type: "text",
  sentAt: 1900000000, data: { text: "Integration probe" },
};

function provider(data: unknown) {
  return new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } });
}
function sessionCookie() {
  const response = attachIntegrationSession(gateResponse({}), false);
  return `${SESSION_COOKIE}=${response.cookies.get(SESSION_COOKIE)!.value}`;
}
function request(path: string, body = "{}", origin: string | null = LOCAL_ORIGIN, cookie?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (origin !== null) headers.origin = origin;
  if (cookie) headers.cookie = cookie;
  return new NextRequest(`${LOCAL_ORIGIN}${path}`, { method: "POST", headers, body });
}
function route(operation: string, body = "{}", origin: string | null = LOCAL_ORIGIN, cookie = sessionCookie()) {
  return integrationPost(request(`/api/integration/${operation}`, body, origin, cookie), { params: Promise.resolve({ operation }) });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("COMETCHAT_APP_ID", "syntheticapp");
  vi.stubEnv("COMETCHAT_REGION", "eu");
  vi.stubEnv("COMETCHAT_REST_API_KEY", "synthetic-server-key");
  vi.stubEnv("APP_ORIGIN", "");
  vi.stubEnv("NODE_ENV", "test");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("synthetic exact court membership", () => {
  it("accepts exactly the four expected identities in a private group", async () => {
    fetchMock.mockResolvedValueOnce(provider(privateGroup)).mockResolvedValueOnce(provider([...roster].reverse()));
    const result = await verifyGroupMembers();
    expect(result.guid).toBe(INTEGRATION_GUID);
    expect(new Set(result.members.map(actor => actor.uid))).toEqual(new Set(roster.map(actor => actor.uid)));
  });

  const invalidGroups = [
    ["missing role", privateGroup, roster.slice(0, 3)],
    ["extra identity", privateGroup, [...roster, { uid: "outsider", name: "Outsider" }]],
    ["duplicate allowed identity", privateGroup, [roster[0], roster[1], roster[2], roster[2]]],
    ["wrong returned GUID", { ...privateGroup, guid: "another-court" }, roster],
    ["public group", { ...privateGroup, type: "public" }, roster],
    ["untrusted role replacing risk", privateGroup, [...roster.slice(0, 3), { uid: "outsider", name: "Outsider" }]],
  ] as const;
  it.each(invalidGroups)("rejects %s", async (_label, group, members) => {
    fetchMock.mockResolvedValueOnce(provider(group)).mockResolvedValueOnce(provider(members));
    await expect(verifyGroupMembers()).rejects.toMatchObject({ code: "GROUP_MEMBERSHIP_VERIFICATION_FAILED" });
  });
});

describe("synthetic fixed identities and provider authority", () => {
  it("mints only a human token despite a client UID parameter", async () => {
    fetchMock.mockResolvedValueOnce(provider({ uid: HUMAN_UID, authToken: "synthetic-human-token" }));
    const response = await tokenPost(request("/api/cometchat/token?uid=risk_agent", JSON.stringify({ uid: "risk_agent" }), LOCAL_ORIGIN, sessionCookie()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ uid: HUMAN_UID, authToken: "synthetic-human-token", appId: "syntheticapp", region: "eu" });
    expect(String(fetchMock.mock.calls[0][0])).toContain(`/users/${HUMAN_UID}/auth_tokens`);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects a provider token for another identity", async () => {
    fetchMock.mockResolvedValueOnce(provider({ uid: "risk_agent", authToken: "wrong-token" }));
    await expect(mintHumanToken()).rejects.toMatchObject({ code: "AUTH_TOKEN_VERIFICATION_FAILED" });
  });

  it("sends on behalf of executor with a server-built group message", async () => {
    fetchMock.mockResolvedValueOnce(provider(privateGroup)).mockResolvedValueOnce(provider(roster))
      .mockResolvedValueOnce(provider({ ...humanMessage, sender: "executor_agent" }));
    const result = await integrationAgentPing();
    expect(result).toMatchObject({ id: "1234", sender: "executor_agent" });
    const [url, options] = fetchMock.mock.calls[2];
    expect(String(url)).toMatch(/\/messages$/);
    expect(options).toMatchObject({ method: "POST", headers: { onBehalfOf: "executor_agent" } });
    expect(JSON.parse(String(options?.body))).toMatchObject({ receiver: INTEGRATION_GUID, receiverType: "group", data: { metadata: { purpose: "gate0", nonce: result.nonce } } });
  });

  it("rejects a send acknowledgement from the wrong sender", async () => {
    fetchMock.mockResolvedValueOnce(provider(privateGroup)).mockResolvedValueOnce(provider(roster)).mockResolvedValueOnce(provider(humanMessage));
    await expect(integrationAgentPing()).rejects.toMatchObject({ code: "AGENT_SEND_VERIFICATION_FAILED" });
  });

  it("does not send when membership cannot be fetched", async () => {
    fetchMock.mockRejectedValueOnce(new Error("synthetic upstream outage with secret detail"));
    await expect(integrationAgentPing()).rejects.toMatchObject({ code: "COMETCHAT_UNREACHABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("GET");
  });

  it("provider outage returns only a sanitized failure, never success proof", async () => {
    fetchMock.mockRejectedValueOnce(new Error("synthetic-server-key upstream timeout"));
    const response = await route("agent-message");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "COMETCHAT_UNREACHABLE" });
  });
});

describe("synthetic immutable CometChat read-back", () => {
  it("returns text read from the provider in the human identity context", async () => {
    fetchMock.mockResolvedValueOnce(provider(humanMessage));
    expect(await verifyIntegrationMessage("1234", HUMAN_UID)).toEqual({ id: "1234", sender: HUMAN_UID, receiver: INTEGRATION_GUID, text: "Integration probe", sentAt: 1900000000 });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", headers: { onBehalfOf: HUMAN_UID } });
  });

  const tampered = [
    ["wrong id", { id: "5678" }],
    ["wrong sender", { sender: "executor_agent" }],
    ["wrong court", { receiver: "another-court" }],
    ["direct message", { receiverType: "user" }],
    ["action category", { category: "action" }],
    ["non-text message", { type: "image" }],
    ["edited message", { editedAt: 1900000001 }],
    ["deleted message", { deletedAt: 1900000001 }],
  ] as const;
  it.each(tampered)("rejects %s", async (_label, changes) => {
    fetchMock.mockResolvedValueOnce(provider({ ...humanMessage, ...changes }));
    await expect(verifyIntegrationMessage("1234", HUMAN_UID)).rejects.toMatchObject({ code: "MESSAGE_READBACK_FAILED", status: 409 });
  });

  it.each(["../1234", "", "NaN"])("rejects invalid reference %j before provider access", async id => {
    await expect(verifyIntegrationMessage(id, HUMAN_UID)).rejects.toMatchObject({ code: "INVALID_MESSAGE_REFERENCE", status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("synthetic origin and request boundary", () => {
  it.each([LOCAL_ORIGIN, "http://localhost:3010"])("allows loopback origin %s for local demo", origin => {
    expect(() => requireSameOrigin(request("/api/integration/setup", "{}", origin))).not.toThrow();
  });

  it("accepts configured production origin when Next sees an internal proxy hostname", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("APP_ORIGIN", "https://demo.example");
    const proxied = new NextRequest("http://internal-proxy:3010/api/integration/setup", { method: "POST", headers: { origin: "https://demo.example" } });
    expect(() => requireSameOrigin(proxied)).not.toThrow();
  });

  it("production without configured origin fails closed", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => requireSameOrigin(request("/api/integration/setup"))).toThrow("SAME_ORIGIN_REQUIRED");
  });

  it.each([null, "https://attacker.example", "http://127.0.0.1:3010.evil"])("rejects origin %j before provisioning", async origin => {
    const response = await route("setup", "{}", origin);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "SAME_ORIGIN_REQUIRED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects missing session before minting a human token", async () => {
    const response = await tokenPost(request("/api/cometchat/token"));
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["null", "[]", "42", '"text"', "{}", '{"messageId":"1234","sender":"risk_agent"}'])("rejects malformed message body %s before provider access", async body => {
    const response = await route("verify-message", body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_MESSAGE_REFERENCE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON before provider access", async () => {
    const response = await route("verify-message", "not-json");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_JSON" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
