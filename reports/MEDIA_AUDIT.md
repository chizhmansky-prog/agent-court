# Independent exported-media audit

FINAL_STATUS: MEDIA_AUDIT_PASS

Scope: read-only inspection of the exported movie and frozen source captures. Only this report and extracted QA frames were created. No application, renderer, source capture, final movie, verification JSON, publishing, or X upload was changed.

## Export read-back

Actual `ffprobe` execution against `submission/final-video.mp4`:

| Check | Observed | Result |
| --- | --- | --- |
| Duration | 80.021333 seconds | PASS: below 90 seconds |
| Frame size | 1280 × 960 | PASS |
| Video codec / pixel format | H.264 / yuv420p | PASS |
| Average frame rate | 30/1 | PASS |
| Audio | AAC, 48 kHz, stereo | PASS |
| Silence | Actual FFmpeg volumedetect: mean −91.0 dB, max −91.0 dB | PASS |
| File size | 1,636,030 bytes | Read back |

The container reports sample aspect ratio 1515:1513; the difference from square pixels is approximately 0.13% and produces no visible distortion in the inspected frames. This is non-blocking.

Export SHA-256: `d1e1aa86cd0f88f22fd6c48e09920c25a4f1e9815e065da5472e657bb001097d`.

## Source integrity

Actual SHA-256 calculations matched `submission/video-verification.json` for 10/10 files:

- Final movie and `submission/video-manifest.json`.
- `reports/demo-home.jpg`, `demo-low.jpg`, `demo-court.jpg`, `demo-human.jpg`, `demo-receipt.jpg`, and `demo-skills.jpg`.
- `agent-court/public/fonts/ibm-plex-mono-500.ttf` and `ibm-plex-mono-400.ttf`.

Source captures remained unchanged. The output and manifest hashes agree with the recorded export envelope. `submission/render_demo.py` describes image scaling/padding, explanatory captions and cuts, with no synthetic chat generation.

## Actual exported-frame review

Frames were independently extracted from the final MP4 using FFmpeg and viewed at their original resolution, rather than relying on renderer preview PNGs.

| Timestamp / frame | Visible evidence | Result |
| --- | --- | --- |
| 3 s — `media-qa/frame-3.png` | Actual homepage, three refund cases, modern dark interface and gate diagram; opening heading and caption | PASS |
| 12 s — `media-qa/frame-12.png` | LOW case €80; CLOSED state; actual receipt requested €80 / execution €80 / prevented €0; explicit simulated-money text | PASS |
| 25 s — `media-qa/frame-25.png` | CometChat private room, 4 members, proposal content, Evidence Agent, Risk Agent objection, €850 request / €425 policy maximum, WAITING HUMAN | PASS |
| 43 s — `media-qa/frame-43.png` | Actual human `APPROVE €425` above the Executor's €425 simulated execution message; CLOSED state and receipt beginning | PASS |
| 58 s — `media-qa/frame-58.png` | Actual receipt requested €850 / executed €425 / prevented €425, human message #36, counterfactual €850 versus €425, simulated case wording | PASS |
| 70 s — `media-qa/frame-70.png` | Real editor displaying CometChat AGENTS.md instructions; visible official `npx --yes @cometchat/skills@5.0.1 add --family react --ide codex` command and successful skill/MCP install output | PASS |
| 78 s — `media-qa/frame-78.png` | Actual homepage outro, Agent Court / Zero to Chat identification and explicit simulated-money wording | PASS |

Across all seven samples, explanatory headings and captions fit their areas, have readable contrast, and show no missing euro glyphs or replacement boxes. Important amounts, human decision, receipt and counterfactual are legible. Some long chat messages are collapsed by the real UI's Read more control, and the court viewport cuts the earlier sender line; the relevant identities and amounts remain visible across the sequence and captions. These are non-blocking presentation details.

Every reviewed frame visibly carries `ACTUAL RUNTIME CAPTURE / EDITED DEMO / SIMULATED MONEY`. The movie is an edited sequence of real screenshots with captions, not a continuous screen recording. No animation of fake incoming messages or synthetic transcript is represented as live runtime.

## Runtime-evidence boundary

This audit certifies the media artifact and its hash-matching capture sources. It does not independently rerun deployment or issue new chat/refund actions.

The separately read `reports/public-live-readback.json` contains the public-session messages 49–54, four actor identities, an €850 approval attempt followed by human message 53 approving €425 and Executor message 54 recording simulated execution. The deployment receipt records that the €850 attempt was blocked. `reports/public-deployment-receipt.json` associates that separate session with `https://burning-stephen-contractors-really.trycloudflare.com`. The movie's human message #36 is from its own earlier captured session; it is not misidentified as public-session message #53.

## Decision

PASS for the requested contest-demo media gate: an under-90-second exported artifact visibly demonstrates the working court flow, real CometChat human decision, simulated outcome, counterfactual and actual CometChat Skills/editor/CLI usage. No release-blocking media finding remains in this scoped audit.

Stop condition reached. No implementation repair or competition upload was performed.

