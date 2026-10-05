"use client";
import { CometChatUIKit } from "@cometchat/chat-uikit-react";
export const HUMAN_UID = "human_judge";
export type ClientToken = { uid: string; authToken: string; appId: string; region: string };
export async function demoPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}), cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "DEMO_REQUEST_FAILED");
  return result;
}
let initPromise: Promise<unknown> | null = null;
let loginPromise: Promise<unknown> | null = null;
export async function connectCometChat(token: ClientToken) {
  if (!initPromise) {
    initPromise = CometChatUIKit.initFromSettings({ appId: token.appId, region: token.region, credentials: {}, chatSDK: { presenceSubscription: { type: "ALL_USERS" } } });
    initPromise.catch(() => { initPromise = null; });
  }
  await initPromise;
  if (!loginPromise) loginPromise = (async () => {
    const existing = CometChatUIKit.getLoggedInUser();
    if (existing?.getUid() === HUMAN_UID) return existing;
    if (existing) await CometChatUIKit.logout();
    return CometChatUIKit.loginWithAuthToken(token.authToken);
  })();
  try { await loginPromise; } finally { loginPromise = null; }
  if (CometChatUIKit.getLoggedInUser()?.getUid() !== HUMAN_UID) throw new Error("HUMAN_LOGIN_MISMATCH");
}
