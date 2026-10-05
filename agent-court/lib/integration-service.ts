import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { IntegrationError } from "./cometchat-server";

const sessionStore = globalThis as typeof globalThis & { courtGateSessions?: Map<string, number> };
const sessions = sessionStore.courtGateSessions ??= new Map<string, number>();
export const SESSION_COOKIE = "agent_court_demo";
export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  // NextRequest.nextUrl can reflect an internal proxy hostname. Trust only an
  // explicit deployment origin; local development has a fixed loopback list.
  const configuredOrigin = process.env.APP_ORIGIN?.trim();
  const allowedOrigins = configuredOrigin ? [configuredOrigin] : process.env.NODE_ENV === "production" ? [] : ["http://127.0.0.1:3010", "http://localhost:3010"];
  if (!origin || !allowedOrigins.includes(origin)) throw new IntegrationError("SAME_ORIGIN_REQUIRED", 403);
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > 4096) throw new IntegrationError("REQUEST_TOO_LARGE", 413);
}
export function requireIntegrationSession(request: NextRequest) {
  requireSameOrigin(request);
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session || (sessions.get(session) ?? 0) < Date.now()) throw new IntegrationError("DEMO_SESSION_REQUIRED", 401);
}
export function attachIntegrationSession(response: NextResponse, secure: boolean) {
  for (const [key, expires] of sessions) if (expires < Date.now()) sessions.delete(key);
  const id = crypto.randomUUID();
  sessions.set(id, Date.now() + 3600000);
  response.cookies.set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "strict", secure, maxAge: 3600, path: "/" });
  return response;
}
export function gateResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export function gateError(error: unknown) {
  return gateResponse({ error: error instanceof IntegrationError ? error.code : "INTEGRATION_FAILED" }, error instanceof IntegrationError ? error.status : 502);
}
