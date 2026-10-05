import { NextRequest } from "next/server";
import { HUMAN_UID, IntegrationError, integrationAgentPing, setupIntegration, verifyIntegrationMessage } from "@/lib/cometchat-server";
import { attachIntegrationSession, gateError, gateResponse, requireIntegrationSession, requireSameOrigin } from "@/lib/integration-service";
export const runtime = "nodejs";
export async function POST(request: NextRequest, context: { params: Promise<{ operation: string }> }) {
  try {
    const { operation } = await context.params;
    if (operation === "setup") {
      requireSameOrigin(request);
      const group = await setupIntegration();
      return attachIntegrationSession(gateResponse(group), request.nextUrl.protocol === "https:");
    }
    requireIntegrationSession(request);
    if (operation === "agent-message") return gateResponse(await integrationAgentPing());
    if (operation === "verify-message") {
      const body = await request.json().catch(() => { throw new IntegrationError("INVALID_JSON", 400); });
      if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.messageId !== "string" || ![HUMAN_UID, "executor_agent"].includes(body.sender)) throw new IntegrationError("INVALID_MESSAGE_REFERENCE", 400);
      return gateResponse(await verifyIntegrationMessage(body.messageId, body.sender));
    }
    throw new IntegrationError("UNKNOWN_INTEGRATION_OPERATION", 404);
  } catch (error) { return gateError(error); }
}
