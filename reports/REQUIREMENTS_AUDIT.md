# Independent requirements audit

All three source documents read fully (503, 401, 494 lines). Initial baseline: specifications only.

Canonical scope: deterministic policy, €80 LOW bypass, €300 MEDIUM REVIEW, €850/72h HIGH Court, four actual CometChat identities, real human chat decision, simulated receipt and €425 counterfactual. No DB, LLM, payment system, product identity or agent framework.

Contract decisions:
- Gate0 (03 §6.9/§16) must precede product build; actual evidence now in GATE0_EVIDENCE.md.
- Server CometChat GET message is sole decision authority; browser amount/text cannot authorize.
- Verify exact four unique members and current GUID after group creation.
- Canonical server templates only; no arbitrary evidence relay.
- Validate human sender/group/current run, post-evidence freshness, edit/delete and consumption.
- One terminal decision and simulated execution within one Node process; restart fails closed. No distributed/Vercel exactly-once claim.
- Integer cents, narrow parser; omit optional override/LLM. MEDIUM pauses REVIEW.
- HIGH receipt carries actual human message ID; LOW identifies automatic policy path.

Independent integration findings repaired: origin comparison behind Next proxy, exact roster/GUID, null JSON, UI error/realtime-proof consistency. Historical integration messages must not authorize product actions.

40 local mocked integration probes PASS. Actual provider Gate0 independently passed human send, agent realtime, history and read-back. Shared human identity is demo-only. Core implementation/audit and delivery pending at report time.

FINAL_STATUS: REQUIREMENTS_AUDIT_COMPLETE_GATE0_VERIFIED_CORE_PENDING
