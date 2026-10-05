# Agent Court

Before an autonomous agent acts, it may have to defend the action.

Zero to Chat 2026 demo. Built with CometChat Skills.

Agent Court creates a live CometChat room before a risky simulated refund. Executor proposes €850, Evidence establishes a €425 policy maximum, Risk objects, and a human sends `APPROVE €425`. The server reads that exact message from CometChat before producing the €425 execution receipt. The counterfactual shows €425 of policy-violating refund prevented in this simulated case.

**Delivery status:** local core and real CometChat flow verified; public delivery and submission pending. All refunds are simulated; no money moves.

| Deliverable | Current status |
|---|---|
| Live CometChat integration | Verified; [Gate 0 evidence](reports/GATE0_EVIDENCE.md) |
| HIGH court, invalid decisions, valid approval and receipt | Verified; [provider read-back](reports/high-live-readback.json) |
| Repository tests | 126/126 passed at the recorded core checkpoint |
| Independent synthetic audit | 29 core and 9 API probes passed; [reproduction report](reports/INDEPENDENT_CORE_AUDIT.md) |
| Final dark UI screenshot | PENDING capture: `reports/product-dark.jpg` |
| Demo video, under 90 seconds | PENDING recording/export |
| Public GitHub repository | PENDING creation/publication |
| Public demo URL and production smoke | PENDING hosting/publication |
| X submission URL | PENDING authorization and publication |

Source code is inside **`agent-court/`**. From this package root:

```powershell
cd agent-court
npm ci
# For a new checkout only: copy .env.example to .env.local and fill its values.
npm run dev
```

Open [the local app](http://127.0.0.1:3010). See the [application README](agent-court/README.md) for credentials, the demo flow, verification, and deployment boundaries.

The original requirements remain authoritative:

- [Technical specification and sequential plan](01_TZ_AND_SEQUENTIAL_PLAN.md)
- [Product logic and execution invariant](02_AGENT_COURT_LOGIC.md)
- [Integration and submission requirements](03_STACK_DEPENDENCIES_INTEGRATIONS_REGISTRATION.md)

[Completion plan](COMPLETION_PLAN.md) records the execution phases. [Demo script](submission/DEMO_SCRIPT.md) and [tweet draft](submission/TWEET_DRAFT.md) prepare the remaining delivery work. They do not certify a published submission.

The runtime deliberately has no database. Run one persistent Node process: restart loses active run IDs, which then return HTTP 410. Capacity is 100 runs per process; completed decisions are retained to prevent replay. Stateless or multiple-instance hosting is unsupported. The prepared Dockerfile has not been built or run because a Docker daemon is unavailable.
