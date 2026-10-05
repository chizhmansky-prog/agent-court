import type { NextRequest } from "next/server";
import { courtApiError, courtStatus, startCourt } from "@/lib/court-service";
import { CourtError } from "@/lib/court-runtime";
import { gateResponse } from "@/lib/integration-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ operation: string }> }) {
  try {
    const { operation } = await context.params;
    if (operation === "start") return gateResponse(await startCourt(request));
    if (operation === "status") return gateResponse(await courtStatus(request));
    throw new CourtError("UNKNOWN_COURT_OPERATION", 404);
  } catch (error) { return courtApiError(error); }
}
