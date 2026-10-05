# Agent Court — 80-second demo recording plan

Status: prepared script; final recording/export PENDING. Target 80 seconds, hard limit under 90 seconds. Capture the actual application and real CometChat messages; text overlays explain the recorded behavior. Never substitute a synthetic transcript or animated reconstruction for integration evidence.

| Time | Actual screen/action | Voice or caption |
|---|---|---|
| 0–7s | Dark home screen, Agent Court title and three cases | “AI agents can act. Who stops them when the action breaks policy?” |
| 7–14s | Run €80 case; show its automatic simulated receipt, then select the €850 case | “Small refunds proceed. An €850 request after 72 hours needs a court.” |
| 14–23s | Click **Convene court**; show HIGH state, case summary and actual CometChat group | “The action pauses. A private room brings together Executor, Evidence, Risk and Human.” |
| 23–37s | Actual proposal, evidence and objection in the CometChat message list; frame maximum €425 | “The policy allows only 50%. Evidence verifies €425. Risk challenges the full refund.” |
| 37–45s | Send `APPROVE €850` through the real composer; show blocked decision and waiting state | “Even a human approval above the limit cannot silently bypass policy.” |
| 45–55s | Click **Approve €425** or type `APPROVE €425`; show the actual human message | “The human changes the action. This decision is a real CometChat message.” |
| 55–65s | Executor execution message and receipt with message provenance | “The server reads that message back before executing the simulated €425 refund.” |
| 65–73s | Counterfactual: without court €850, with court €425, prevented €425 | “€425 of policy-violating refund prevented in this simulated case.” |
| 73–78s | Actual terminal installation evidence or installed official Skills folder + command label | “Built with CometChat Skills.” Show `npx @cometchat/skills@5.0.1 add --family react --ide codex`. |
| 78–80s | Agent Court title over the actual result screen | “Give autonomous agents somewhere to be challenged.” |

Keep **SIMULATED** visible whenever showing the refund result. Avoid voice/video-call UI and architectural explanations that consume demo time. Use actual recorded UI for the state transitions, human send and receipt; optional cuts may remove waiting time without fabricating responses.

## Before recording

- Final dark UI smoke passed and the browser is at the actual local/public app.
- Fresh dedicated court run, real CometChat connected, exact four identities verified.
- One persistent Node process remains running through the complete recording.
- No `.env.local`, REST key, Auth Key, human auth token or dashboard credential panel is visible.
- Terminal shot shows the genuine installed official Skills provenance, without secrets.

The previously verified actual run is preserved in `../reports/high-live-readback.json`: agent messages 9–11, invalid decisions 12–13, valid human decision 14 and receipt 15. Those IDs document an earlier run; a fresh recording must preserve its own genuine message IDs and receipt.

## Export and read-back

Save the final media as `submission/final-video.mp4` at this package root. Read its duration from the exported file, verify it is under 90 seconds, and inspect the opening, actual chat, human send, receipt, counterfactual and Skills shot. Confirm €850 requested / €425 executed / €425 prevented, clear text and no secrets. Preserve the final screenshot and final commit SHA alongside publication evidence.

Public repository and live URL are PENDING. Do not add placeholder URLs to the video as if they were working links. Once published, test the public URL in a fresh browser session before submission.
