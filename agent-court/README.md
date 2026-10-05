# Agent Court

Before an autonomous agent acts, it may have to defend the action.

Zero to Chat 2026 demo. Built with CometChat Skills.

**Verified locally:** real CometChat integration and the HIGH-risk court → human decision → simulated refund → receipt flow. **Pending:** public repository, public demo URL, final video and X submission. Final dark UI screenshot is awaiting capture at `../reports/product-dark.jpg`.

## What the demo does

| Case | Risk | Behavior |
|---|---|---|
| ORDER-101: €80, 12 hours old | LOW | Simulated execution without a court |
| ORDER-202: €300, 36 hours old | MEDIUM | Paused in agent review; no execution |
| ORDER-303: €850, 72 hours old | HIGH | Private CometChat court; maximum refund €425 |

The deterministic policy permits the paid amount through 48 hours; afterwards it permits 50%, calculated in integer cents. No LLM decides amounts, risk, or permissions.

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

Use Node.js 22 for consistency with the prepared Docker runtime. The lockfile fixes the resolved dependency versions: install with `npm ci`.

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

The official Skills pack was installed as `@cometchat/skills@5.0.1`; its React v7 guidance is included under `.cometchat/skills`. The installation and dashboard provisioning commands are:

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

## API and identity boundaries

| Endpoint | Accepted input |
|---|---|
| `POST /api/court/start` | `{ "caseId": "ORDER-101" \| "ORDER-202" \| "ORDER-303" }` |
| `POST /api/court/status` | `{ "runId": "..." }` |
| `POST /api/refund` | `{ "runId": "...", "decisionMessageId": "123" }` |

Successful product responses are a public `CourtRun`. Inputs use exact fields; message IDs are numeric strings, avoiding JavaScript integer truncation. Product APIs require an HTTP-only, one-hour demo session and an allowed Origin. Run access is bound to the session that created it.

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

The prepared [Dockerfile](Dockerfile) runs a non-root standalone Node server and includes static assets. **Docker build/run is UNVERIFIED:** the local Docker daemon is unavailable. Public host setup and a fresh production smoke are PENDING.

## Verification and evidence

```powershell
npm test
npm run typecheck
npm run lint
npm run build
node scripts/verify-secrets.mjs
```

The recorded core checkpoint passed **126/126 repository tests**, typecheck and lint. Tests cover policy, grammar, identity/room provenance, freshness, replay/concurrent decisions, failures, restart/capacity and API session/origin/input boundaries. These are synthetic checks and do not certify realtime chat.

Actual evidence is separate:

- [Gate 0](../reports/GATE0_EVIDENCE.md): browser human message 4 and incoming Executor message 5, SDK history and server read-back.
- [HIGH flow read-back](../reports/high-live-readback.json): proposal 9, evidence 10, risk objection 11; above-policy approval 12 and malformed decision 13 did not execute; valid approval 14 produced Executor receipt message 15 for a €425 simulated refund.
- [Independent audit and exact reproduction](../reports/INDEPENDENT_CORE_AUDIT.md): 29 core and 9 API probes passed; the reported frontend decision-queue finding was repaired and its independent reproduction passed.

Final dark UI build/smoke, public production smoke, screenshot/video and publication evidence must be recorded separately after those steps complete. A successful build is not behavioral proof.

## Delivery status

| Item | Status |
|---|---|
| Public repository URL | PENDING |
| Public demo URL | PENDING |
| Final screenshot | PENDING: `../reports/product-dark.jpg` |
| Video under 90 seconds | PENDING |
| X quote-post and submission URL | PENDING |
| Docker image runtime | UNVERIFIED |

The [original three specifications](../README.md) remain the source of product requirements. [Demo script](../submission/DEMO_SCRIPT.md) and [tweet draft](../submission/TWEET_DRAFT.md) are prepared for review. Publishing requires the outstanding delivery steps and authorization; this README does not claim that submission is complete.
