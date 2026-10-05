import type { NextRequest } from "next/server";
import { courtApiError, refundFromCourt } from "@/lib/court-service";
import { gateResponse } from "@/lib/integration-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try { return gateResponse(await refundFromCourt(request)); }
  catch (error) { return courtApiError(error); }
}
