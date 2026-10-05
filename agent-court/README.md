# Agent Court

Before an autonomous agent acts, it may have to defend the action.

Zero to Chat 2026 demo. Built with CometChat Skills.

**Verified publicly:** real CometChat integration and the HIGH-risk court → human decision → simulated refund → receipt flow. [Public demo](https://burning-stephen-contractors-really.trycloudflare.com) · [Public repository](https://github.com/chizhmansky-prog/agent-court) · [Video](../submission/final-video.mp4).

![Agent Court dark interface](../reports/product-dark.jpg)

The video is an **edited demo from actual production runtime captures**, with actual editor/official CLI Skills evidence. It is not a continuous screen recording. Export metadata verifies 80.021333 seconds, 1280×960, H264/yuv420p, 30fps and AAC. Independent visual review passed; the user confirmed this is their only entry. [The X entry was submitted and read back](https://x.com/guyver65731/status/2107054208327278951).

## What the demo does

| Case | Risk | Behavior |
|---|---|---|
| ORDER-101: €80, 12 hours old | LOW | Simulated execution without a court |
| ORDER-202: €300, 36 hours old | MEDIUM | Paused in agent review; no execution |
| ORDER-303: €850, 72 hours old | HIGH | Private CometChat court; maximum refund €425 |

The deterministic policy permits the paid amount through 48 hours; afterwards it permits 50%, calculated in integer cents. No LLM decides amounts, risk, or permissions.

Executor, Evidence and Risk are deterministic roles posting genuine CometChat messages. The distinguishing idea is runtime governance: a proposed €850 refund is challenged before execution, then the human's chat decision changes the simulated action to €425. The without-court counterfactual is €850; the measured simulated outcome prevents the €425 above-policy amount.

Choose **Convene court** on the €850 card. Four real CometChat identities join the room: Human Approver, Executor, Evidence and Risk. The agents publish a proposal, policy evidence and objection. Send `APPROVE €425` through the composer or **Approve €425**. The button sends an ordinary CometChat message. `REJECT` closes the case without executing a refund.

`APPROVE €850` and malformed commands preserve the waiting state with zero execution. A valid decision produces a receipt showing requested €850, executed €425 and prevented €425. All refunds are simulated: no payment provider is connected and no money moves.

## Why CometChat is load-bearing

```text
Canonical case → risk gate → unique private CometChat group
→ verified roster and agent evidence → human CometChat message
→ server GET /messages/{id} → validation → simulated action → receipt
```

The browser submits only `runId` and `decisionMessageId`. The server obtains the decision text, sender and room from CometChat; client amounts, text, actors and policy overrides cannot authorize execution. The decision must come from `human_judge`, belong to the current court, follow all three evidence IDs, be fresh and unedited, and satisfy the canonical policy.

A per-run queue commits one immutable decision before execution. Exact retries return the same receipt; conflicting IDs return HTTP 409. Group, membership and evidence failures block the action. Execution or receipt acknowledgement failure produces `FAILED_EXECUTION` without a success receipt and is never retried.

## Setup

Use Node.js 22, matching the verified Linux runtime. The lockfile fixes the resolved dependency versions: install with `npm ci`.

From the package root, first enter `agent-court/`. Commands below run inside this application directory:

```powershell
npm ci
# New checkout only; preserve an existing credential file.
Copy-Item .env.example .env.local
```

Fill `.env.local` locally with the values for a dedicated CometChat demo app:

```dotenv
COMETCHAT_APP_ID=
COMETCHAT_REGION=
COMETCHAT_REST_API_KEY=
APP_ORIGIN=
```

Region is `eu`, `us` or `in` and must match the app. `COMETCHAT_REST_API_KEY` must have **fullAccess** scope. App ID/Region identify the app; REST credentials stay on the server. Human SDK login uses a server-minted auth token. Browser Auth Keys and client-side agent credentials are absent.

The official Skills pack was installed as `@cometchat/skills@5.0.1`; 25 generated skills under `.cometchat/skills` were actually used locally. This generated directory and dependency caches are gitignored in the public repository; reinstall them in a fresh checkout. The public AGENTS.md retains the routing instructions. Installation and dashboard provisioning commands are:

```powershell
npx @cometchat/skills@5.0.1 add --family react --ide codex
npx @cometchat/skills-cli@3 auth login
npx @cometchat/skills-cli@3 provision run
```

The dashboard CLI obtains App ID/Region/Auth Key and a framework-neutral local config. The fullAccess REST key used by this app must be obtained from the app credentials dashboard separately. Do not copy the Auth Key into browser environment variables. `.env.local` and `.cometchat/config.json` are gitignored. [Official Skills source](https://github.com/cometchat/cometchat-skills), [Next.js integration](https://www.cometchat.com/docs/ui-kit/react/integration-nextjs), [server REST messaging](https://www.cometchat.com/docs/rest-api/messages/send-message).

```powershell
npm run dev
```

Open [http://127.0.0.1:3010](http://127.0.0.1:3010). Starting a case prepares the fixed demo identities and logs in the Human Approver. **Integration evidence** opens `/integration` for the separate Gate 0 check: a human send, incoming Executor message, verified history and server read-back. Historical messages alone cannot establish realtime delivery.

`predev` and `prebuild` fetch Satoshi weights 400/500/700/900 unmodified from official Fontshare into this checkout. Those font binaries are gitignored. `npm run fonts` repeats the presence/download check; the active public runtime fetched its own copies. The IBM Plex Mono caption assets and font notices are retained.

## API and identity boundaries

| Endpoint | Accepted input |
|---|---|
| `POST /api/court/start` | `{ "caseId": "ORDER-101" \| "ORDER-202" \| "ORDER-303" }` |
| `POST /api/court/status` | `{ "runId": "..." }` |
| `POST /api/refund` | `{ "runId": "...", "decisionMessageId": "123" }` |

Successful product responses are a public `CourtRun`. Inputs use exact fields; message IDs are numeric strings, avoiding JavaScript integer truncation. Product APIs require an HTTP-only, one-hour demo session and an allowed Origin. Public cookies were verified as Secure, HttpOnly and SameSite=Strict. Run access is bound to the session that created it.

`/api/integration/setup` provisions the dedicated four-actor integration room and session. `/api/cometchat/token` issues a token for the fixed `human_judge`. The integration agent-message and verify-message endpoints are limited to the integration room and fixed actors.

All visitors share the demo `human_judge` identity. Session isolation is an API boundary, not authentication of distinct humans. Use a dedicated app with no real customer identities or data; product authentication is outside this MVP.

## Runtime and hosting

Run **one persistent Node process / one replica**. Run state, sessions, decision tombstones and idempotency live in memory; there is no database. Restart makes old run IDs unavailable (HTTP 410) and requires reopening chat. At 100 runs per process, new runs return HTTP 503; old terminal decisions are retained rather than evicted. A waiting court's decision window is 15 minutes.

Stateless Vercel/serverless functions and multiple replicas do not satisfy this runtime contract. A persistent Node host or one container is the supported target.

For production, set `APP_ORIGIN` to the **exact public origin**, including scheme and host, with no trailing slash. Without it production POST requests fail closed. Request Host headers cannot expand the allowlist. Development allows `http://127.0.0.1:3010` and `http://localhost:3010`.

```powershell
npm run build
npm run start
```

The active public app runs the [verified Linux CI artifact](https://github.com/chizhmansky-prog/agent-court/actions/runs/37283096306) from source `be724c56279461b9d5c64157eda63eaaa8d2f08e`, with Node 22.23.3 and one persistent user service. Server credentials remain private. An anonymous [Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) supplies HTTPS. It has no uptime guarantee and its hostname changes on tunnel recreation. The scoped lifecycle wrapper rebinds APP_ORIGIN and restarts only the demo Node process when that happens, resetting old run state.

The [deployment receipt](../reports/public-deployment-receipt.json) records source/archive hashes, runtime limits and successful public browser E2E. This temporary demo endpoint is not a stable production hosting claim. The prepared [Dockerfile](Dockerfile) is not the active route; Docker build/run remains unverified.

## Verification and evidence

```powershell
npm test
npm run typecheck
npm run lint
npm run build
node scripts/verify-secrets.mjs
```

The latest Linux CI completed successfully with **127 repository tests**; local lint/typecheck/build were also executed. Tests cover policy, grammar, identity/room provenance, freshness, replay/concurrent decisions, failures, restart/capacity and API session/origin/input boundaries. These are synthetic checks and do not certify realtime chat.

Actual evidence is separate:

- [Gate 0](../reports/GATE0_EVIDENCE.md): browser human message 4 and incoming Executor message 5, SDK history and server read-back.
- [HIGH flow read-back](../reports/high-live-readback.json): proposal 9, evidence 10, risk objection 11; above-policy approval 12 and malformed decision 13 did not execute; valid approval 14 produced Executor receipt message 15 for a €425 simulated refund.
- [Public HTTPS browser flow](../reports/public-live-readback.json): proposal 49, evidence 50, objection 51; approval 52 for €850 remained blocked; human 53 approved €425; Executor 54 acknowledged receipt `rcpt_501fd528-17f3-4742-a2ec-024f104a6f44`. Executed €425, prevented €425.
- [Independent audit and exact reproduction](../reports/INDEPENDENT_CORE_AUDIT.md): 29 core and 9 API probes passed; the reported frontend decision-queue finding was repaired and its independent reproduction passed.

The dark UI screenshot and public runtime read-back are available. [Video verification](../submission/video-verification.json) records export metadata and original capture hashes; its independent visual gate passed in [MEDIA_AUDIT](../reports/MEDIA_AUDIT.md). A successful build is not behavioral proof, and a public app is not a submitted contest entry.

## Delivery status

| Item | Status |
|---|---|
| Public repository | [Available](https://github.com/chizhmansky-prog/agent-court) |
| Public demo | [Browser E2E passed](https://burning-stephen-contractors-really.trycloudflare.com); temporary URL/no uptime guarantee |
| Screenshot | Captured above |
| Video | 80.021333s metadata verified; [independent visual review passed](../reports/MEDIA_AUDIT.md) |
| Single-entry check | Confirmed by the user before sending |
| X quote-post/submission URL | [Submitted and read back](https://x.com/guyver65731/status/2107054208327278951) |
| Docker image runtime | UNVERIFIED; not used for this deployment |

The [original three specifications](../README.md) remain the source of product requirements. [Tweet draft](../submission/TWEET_DRAFT.md) and [contest checklist](../submission/CONTEST_CHECKLIST.md) identify the remaining final-send checks. The user subsequently authorized the final send. The video, repository, tags and official quote were verified on the actual published post; [submission receipt](../submission/SUBMISSION_RECEIPT.json). Organizer acceptance is not yet confirmed.
