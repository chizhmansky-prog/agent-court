# Agent Court — contest readiness checklist

Status: **SUBMITTED_AND_BROWSER_READBACK_VERIFIED**. The user authorized final sending and confirmed this is their only entry. [Actual submission](https://x.com/guyver65731/status/2107054208327278951) · [receipt](SUBMISSION_RECEIPT.json). Organizer acceptance remains unconfirmed.

## Official conditions

Checked 5 October 2026 against the [official Zero to Chat page](https://www.cometchat.com/hackathon). Dates: opens 24 September 2026; closes 7 October 2026; winners 9 October 2026. Codex can use official Skills. A valid entry needs working software, visible integration evidence and a video shorter than 90 seconds. Quote the [official X thread](https://x.com/CometChat/status/2103065271233888471), include the public repository, `@CometChat` and `#ZeroToChat`. One entry is allowed per person; existing projects and additional libraries are accepted. The page's code-link wording varies; this package supplies the public repository.

## Working product and provenance

| Check | Status and evidence |
|---|---|
| Real CometChat is central to execution | PASS: server reads the actual human decision before simulation |
| Four role identities and agent messages | PASS: [public read-back](../reports/public-live-readback.json), messages 49–51 |
| Above-policy approval blocked | PASS: human 52 `APPROVE €850` caused no execution |
| Human changes action and receives receipt | PASS: human 53 `APPROVE €425` → Executor 54; executed €425 / prevented €425 |
| LOW bypass / MEDIUM pause | Covered by canonical runtime and repository probes; actual LOW demo capture retained |
| Deterministic facts and roles | PASS: templates use canonical policy/risk; no external LLM authority |
| Actual official Skills use | Installed pack 5.0.1, 25 local generated skills; actual editor/official CLI capture included |
| Public repository | [Available](https://github.com/chizhmansky-prog/agent-court) |
| Linux build and regression | [CI 37283096306 succeeded](https://github.com/chizhmansky-prog/agent-court/actions/runs/37283096306), 127 tests; source `be724c56279461b9d5c64157eda63eaaa8d2f08e` |
| Public HTTPS browser E2E | PASS: [demo](https://burning-stephen-contractors-really.trycloudflare.com), [receipt](../reports/public-deployment-receipt.json) |
| Public cookie attributes | PASS: Secure, HttpOnly, SameSite=Strict |
| Financial boundary | Simulated only; no payment provider or customer money |

The contest idea is a temporary action-governance room: agents must defend the proposed action, evidence challenges it, and a genuine chat decision changes execution. Without the court, the simulated counterfactual is €850; with it, execution is €425 and the €425 above-policy amount is prevented.

## Media and final package

| Check | Current status |
|---|---|
| Screenshot | [Actual dark interface](../reports/product-dark.jpg) |
| Video duration/encoding | PASS metadata: 80.021333s, 1280×960, H264/yuv420p, 30fps, AAC |
| Capture provenance | [Manifest](video-manifest.json) and [source hashes](video-verification.json); edited actual production captures, continuous recording=false |
| Final visual review | PASS: [independent exported-frame review](../reports/MEDIA_AUDIT.md), 7 frames and 10/10 hashes; actual editor/official CLI shot visible |
| Final package commit/push | This package is committed to main; read the exact package SHA from Git HEAD. Deployed application source remains be724c56279461b9d5c64157eda63eaaa8d2f08e |
| Links at final send | PASS: demo and repo HTTP200; exact audited video hash matched; published repo redirect HTTP200 |
| Single-entry eligibility | User confirmed no other entry before sending |
| Final quote-post/upload/send | PASS: [published quote-post](https://x.com/guyver65731/status/2107054208327278951), 80-second video and required tags attached |
| Tweet URL and submission screenshot | [Actual URL](tweet-url.txt), [published screenshot](../reports/submission-sent.png), [browser read-back](../reports/submission-browser-readback.txt) |

The endpoint uses a temporary anonymous Quick Tunnel with no uptime guarantee. Restart rotates its hostname and resets the single Node process's in-memory runs; old references return 410. Capacity is 100 runs per process. This demo endpoint does not certify stable production hosting. Satoshi binaries and generated Skills stay gitignored; fresh checkouts obtain fonts from official Fontshare and reinstall Skills using the README commands.

Final-send conditions were satisfied and exactly one Post action was issued. X confirmed sending; the direct post shows the video, official quotation, mention, hashtag and repository. The account also received an informational discoverability-limit notice; no restriction was bypassed. A sent entry does not certify organizer acceptance or unrestricted search visibility.
