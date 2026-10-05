# Gate 0 — actual CometChat runtime evidence

Verified 2026-10-05, Europe/Riga. No synthetic transcript used.

- CometChat dashboard created Agent Court, App ID `1684336396f5da33c`, region `eu`, Next.js, Chat & Messaging.
- Official `@cometchat/skills@5.0.1` installed with `add --family react --ide codex`.
- Official `@cometchat/skills-cli@3` auth and existing-app provision succeeded; credentials server-only, values not included here.
- Next dev process: `http://127.0.0.1:3010`.
- Private group: `agent-court-integration-gate0`.
- Fresh REST read-back confirms `human_judge`, `executor_agent`, `evidence_agent`, `risk_agent` exist; group roster verified by server and SDK renders `4 Members`.
- Browser init→loginWithAuthToken logged in as `human_judge`.
- Actual UI Kit human message **4**: `Gate 0 — human message through CometChat.` Server GET message read-back passed.
- Actual REST agent message **5**, sender `executor_agent`: `Integration check: real server message from Executor Agent (36c5329a).` Browser received realtime event and server read-back passed.
- SDK group history contained both IDs. Browser output: **GATE0_PASS**.
- Source expected gate 03 §6.9/§16 satisfied; product layer now authorized by source sequencing.

Negative runtime probes: untrusted origin →403; trusted loopback without session→401. First setup failed closed on origin check; no provider action until the guard was repaired. Positive setup+token+message verification returned200.

Local regression is separate: 40 mocked tests PASS; these do not substitute live provider evidence above. Runtime npm audit (`--omit=dev`) reports zero vulnerabilities after nested DOMPurify override; five dev-only audit findings remain in lint dependency chain with no published braces fix at lookup time.

Limit: shared demo `human_judge` identity, not production end-user authentication. No refund/product execution certified by this gate.
