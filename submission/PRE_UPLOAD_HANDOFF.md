# Agent Court — pre-upload handoff

FINAL_STATUS: PRE_UPLOAD_FOUNDATION_VERIFIED / FINAL_UPLOAD_HELD_BY_USER

The requested scope is complete through the final contest-upload boundary. No X video upload, quote-post or send has occurred. No submitted-entry URL is claimed. The original three specifications are preserved; this handoff records their implementation and the user's later narrowed stop condition.

## Open and review

- [Public working demo](https://burning-stephen-contractors-really.trycloudflare.com) — temporary Quick Tunnel URL, with no uptime guarantee.
- [Public source repository](https://github.com/chizhmansky-prog/agent-court).
- [Final 80.021333-second demo](final-video.mp4).
- [Contest conditions and evidence](CONTEST_CHECKLIST.md).
- [Exact quote-post draft and official target](TWEET_DRAFT.md).

## Verified behavior

LOW €80 executes a simulation without a Court. MEDIUM €300 pauses in REVIEW. HIGH €850 creates a unique private CometChat court with four roles and three genuine server-authored agent messages. The server reads a real human decision from CometChat and enforces the €425 policy maximum. No browser-supplied amount or transcript authorizes execution.

The actual public browser run contains proposal49 / evidence50 / objection51. Human52's APPROVE850 was blocked without execution. Human53's APPROVE425 produced Executor54 and receipt `rcpt_501fd528-17f3-4742-a2ec-024f104a6f44`: simulated €425 executed / €425 above-policy amount prevented. [Provider read-back](../reports/public-live-readback.json) and [deployment receipt](../reports/public-deployment-receipt.json) are separate from synthetic tests.

## Evidence gates

| Gate | Evidence |
|---|---|
| Integration before product build | [Gate0 actual PASS](../reports/GATE0_EVIDENCE.md), human4 / realtime executor5 |
| Regression and Linux build | 127/127 tests; lint, typecheck and build passed; [Linux CI](https://github.com/chizhmansky-prog/agent-court/actions/runs/37283096306) |
| Independent behavior audit | [Exact reproduction report](../reports/INDEPENDENT_CORE_AUDIT.md): 29 core, 9 API, 2 decision-queue and 2 final-state probes; no open scoped P1/P2 |
| Authority and failures | Wrong group/sender, stale/edited/replayed IDs, concurrent decisions, client extras, origin/session failures and provider/execution failures fail closed; focused positive/negative probes documented |
| Actual public behavior | €850 blocked; €425 accepted; receipt acknowledged by CometChat; Secure/HttpOnly/SameSite=Strict cookie |
| Media | [Independent audit](../reports/MEDIA_AUDIT.md): seven actual exported frames, 10/10 hashes, H264/yuv420p 1280×960 30fps, AAC silence; no blocking finding |
| Skills provenance | Actual public editor and official pinned CometChat Skills install command visible in the video |
| Secret boundary | Known local server credentials absent from source/browser static bundles; negative planted-fixture scan detected a leak as expected; private credentials ignored |

Movie SHA256: `d1e1aa86cd0f88f22fd6c48e09920c25a4f1e9815e065da5472e657bb001097d`.

The movie is an edited sequence of actual runtime screenshots with captions, not a continuous screen recording. Roles and case data are deterministic, and every financial action is simulated. The movie's earlier human36 capture and the public human53 verification are distinct real sessions.

## Versions and limits

Deployed application source: `be724c56279461b9d5c64157eda63eaaa8d2f08e`. The final package commit additionally contains media, deployment read-back and completed handoff documents; use `git rev-parse HEAD` for that package SHA. Its media/docs changes do not change the deployed application behavior.

One Node process retains state in memory, with 100 runs maximum. Restart makes old runs unavailable (HTTP410); the shared demo human identity is not production end-user authentication. Temporary hosting, Docker runtime and production financial integration are not production readiness claims. Runtime dependencies have zero reported production vulnerabilities; five dev-only high findings in the lint dependency chain remain documented and are not hidden by a blanket clean-dependencies claim.

Before a later final send: confirm no other entry has been submitted by this person, recheck the temporary demo URL and public repository, attach this exact video, quote the official thread and use the prepared text containing @CometChat and #ZeroToChat. The official page closes the contest on 7 October 2026 and does not specify a cutoff time. The original package's safer internal deadline is 6 October at 18:00 Europe/Riga.

Stop condition reached: final upload/send remains under the user's explicit boundary. The single-entry check is HUMAN_CHECK_AT_FINAL_SEND, not eligibility PASS.
