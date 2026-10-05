import "server-only";

export const DEMO_ACTORS = [
  { uid: "human_judge", name: "Human Approver" },
  { uid: "executor_agent", name: "Executor Agent" },
  { uid: "evidence_agent", name: "Evidence Agent" },
  { uid: "risk_agent", name: "Risk Agent" },
] as const;
export const HUMAN_UID = DEMO_ACTORS[0].uid;
export const INTEGRATION_GUID = "agent-court-integration-gate0";
export class IntegrationError extends Error {
  constructor(public code: string, public status = 502) { super(code); }
}
export type RestMessage = {
  id: string; sender: string; receiver: string; receiverType: string;
  category: string; type: string; sentAt?: number; editedAt?: number; deletedAt?: number;
  data: { text?: string; metadata?: Record<string, unknown> };
};
type RestUser = { uid: string; name: string };
type RestGroup = { guid: string; type: string; owner?: string; metadata?: Record<string, unknown>; membersCount?: number };

export function getCometChatConfig() {
  const appId = process.env.COMETCHAT_APP_ID?.trim();
  const region = process.env.COMETCHAT_REGION?.trim();
  const restKey = (process.env.COMETCHAT_REST_API_KEY ?? process.env.COMETCHAT_API_KEY)?.trim();
  if (!appId || !region || !restKey) throw new IntegrationError("COMETCHAT_NOT_CONFIGURED", 503);
  if (!/^[a-zA-Z0-9]+$/.test(appId) || !["eu", "us", "in"].includes(region)) throw new IntegrationError("COMETCHAT_INVALID_CONFIGURATION", 503);
  return { appId, region, restKey };
}

// Never return raw provider errors: they can include request headers or credentials.
export async function cometchatRest<T>(path: string, method = "GET", body?: unknown, onBehalfOf?: string): Promise<T> {
  const { appId, region, restKey } = getCometChatConfig();
  const headers: Record<string, string> = { apikey: restKey, "Content-Type": "application/json" };
  if (onBehalfOf) headers.onBehalfOf = onBehalfOf;
  let response: Response;
  try {
    response = await fetch(`https://${appId}.api-${region}.cometchat.io/v3${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000),
    });
  } catch { throw new IntegrationError("COMETCHAT_UNREACHABLE"); }
  let payload: { data?: T; error?: { code?: string } };
  try { payload = await response.json(); } catch { throw new IntegrationError("COMETCHAT_INVALID_RESPONSE"); }
  if (!response.ok || payload.error) {
    const code = payload.error?.code;
    throw new IntegrationError(code && /^[A-Z0-9_]{1,80}$/.test(code) ? code : "COMETCHAT_REQUEST_FAILED", response.status === 404 ? 404 : 502);
  }
  if (payload.data === undefined) throw new IntegrationError("COMETCHAT_MISSING_DATA");
  return payload.data;
}

async function ensureActor(actor: typeof DEMO_ACTORS[number]) {
  try {
    const user = await cometchatRest<RestUser>(`/users/${actor.uid}`);
    if (user.uid !== actor.uid) throw new IntegrationError("ACTOR_ID_MISMATCH");
  } catch (error) {
    if (!(error instanceof IntegrationError) || error.status !== 404) throw error;
    await cometchatRest<RestUser>("/users", "POST", { ...actor, metadata: { agentCourtDemo: true } });
  }
}

export async function verifyGroupMembers(guid = INTEGRATION_GUID) {
  const group = await cometchatRest<RestGroup>(`/groups/${guid}`);
  const members = await cometchatRest<RestUser[]>(`/groups/${guid}/members?perPage=100&page=1`);
  const expected = new Set<string>(DEMO_ACTORS.map(a => a.uid));
  if (group.guid !== guid || group.type !== "private" || !Array.isArray(members) || members.length !== 4 || new Set(members.map(m => m.uid)).size !== 4 || members.some(m => !expected.has(m.uid))) {
    throw new IntegrationError("GROUP_MEMBERSHIP_VERIFICATION_FAILED");
  }
  return { guid: group.guid, type: group.type, members: members.map(m => ({ uid: m.uid, name: m.name })) };
}

let setupInFlight: Promise<Awaited<ReturnType<typeof verifyGroupMembers>>> | null = null;
export async function setupIntegration() {
  if (!setupInFlight) setupInFlight = (async () => {
    for (const actor of DEMO_ACTORS) await ensureActor(actor);
    try {
      const existing = await cometchatRest<RestGroup>(`/groups/${INTEGRATION_GUID}`);
      if (existing.metadata?.purpose !== "agent-court-gate0" || existing.type !== "private") throw new IntegrationError("GROUP_ID_COLLISION", 409);
    } catch (error) {
      if (!(error instanceof IntegrationError) || error.status !== 404) throw error;
      await cometchatRest("/groups", "POST", {
        guid: INTEGRATION_GUID, name: "Agent Court · integration check", type: "private", owner: HUMAN_UID,
        metadata: { purpose: "agent-court-gate0" },
        members: { admins: [HUMAN_UID], participants: DEMO_ACTORS.slice(1).map(a => a.uid) },
      });
    }
    // Repair only missing members of this dedicated integration group; verify exact roster below.
    const members = await cometchatRest<RestUser[]>(`/groups/${INTEGRATION_GUID}/members?perPage=100&page=1`);
    const missing = DEMO_ACTORS.filter(a => !members.some(m => m.uid === a.uid));
    if (missing.length) await cometchatRest(`/groups/${INTEGRATION_GUID}/members`, "POST", { participants: missing.map(a => a.uid) });
    return verifyGroupMembers();
  })();
  try { return await setupInFlight; } finally { setupInFlight = null; }
}

export async function mintHumanToken() {
  const token = await cometchatRest<{ uid: string; authToken: string }>(`/users/${HUMAN_UID}/auth_tokens`, "POST", { force: false });
  if (token.uid !== HUMAN_UID || !token.authToken) throw new IntegrationError("AUTH_TOKEN_VERIFICATION_FAILED");
  const { appId, region } = getCometChatConfig();
  return { uid: HUMAN_UID, authToken: token.authToken, appId, region };
}

export async function integrationAgentPing() {
  await verifyGroupMembers();
  const nonce = crypto.randomUUID();
  const message = await cometchatRest<RestMessage>("/messages", "POST", {
    receiver: INTEGRATION_GUID, receiverType: "group", category: "message", type: "text",
    data: { text: `Integration check: real server message from Executor Agent (${nonce.slice(0, 8)}).`, metadata: { purpose: "gate0", nonce } },
  }, "executor_agent");
  if (!message.id || message.sender !== "executor_agent" || message.receiver !== INTEGRATION_GUID) throw new IntegrationError("AGENT_SEND_VERIFICATION_FAILED");
  return { id: String(message.id), sender: message.sender, nonce };
}

export async function verifyIntegrationMessage(id: string, expectedSender: string) {
  if (!/^\d{1,24}$/.test(id) || !DEMO_ACTORS.some(a => a.uid === expectedSender)) throw new IntegrationError("INVALID_MESSAGE_REFERENCE", 400);
  const message = await cometchatRest<RestMessage>(`/messages/${id}`, "GET", undefined, HUMAN_UID);
  if (String(message.id) !== id || message.receiver !== INTEGRATION_GUID || message.receiverType !== "group" || message.sender !== expectedSender || message.category !== "message" || message.type !== "text" || message.deletedAt || message.editedAt) {
    throw new IntegrationError("MESSAGE_READBACK_FAILED", 409);
  }
  return { id: String(message.id), sender: message.sender, receiver: message.receiver, text: message.data.text, sentAt: message.sentAt };
}
