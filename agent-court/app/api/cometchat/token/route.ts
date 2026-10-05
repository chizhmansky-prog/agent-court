import { NextRequest } from "next/server";
import { mintHumanToken } from "@/lib/cometchat-server";
import { gateError, gateResponse, requireIntegrationSession } from "@/lib/integration-service";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    requireIntegrationSession(request);
    // Identity is fixed on the server; this endpoint never accepts a client UID.
    return gateResponse(await mintHumanToken());
  } catch (error) { return gateError(error); }
}
