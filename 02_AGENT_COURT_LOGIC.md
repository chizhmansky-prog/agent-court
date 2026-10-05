# Agent Court — логика продукта

## 1. Главный принцип

Agent Court — не support chat. Это **runtime governance layer** для автономных действий.

```text
proposed action
      ↓
risk evaluation
      ↓
LOW ─────────────→ execute
      ↓
HIGH
      ↓
create court
      ↓
executor + evidence + risk + human
      ↓
approve / modify / reject / override
      ↓
execute or block
      ↓
receipt
```

CometChat хранит живой контекст решения и делает human intervention частью исполнения.

## 2. State machine

```text
IDLE
↓
ACTION_PROPOSED
↓
RISK_EVALUATED
├─ LOW  → EXECUTING → CLOSED
├─ MEDIUM → REVIEW
└─ HIGH → COURT_CREATING
              ↓
          COURT_OPEN
              ↓
          WAITING_HUMAN
              ├─ APPROVE
              ├─ MODIFY
              ├─ REJECT
              └─ OVERRIDE
              ↓
          EXECUTING / BLOCKED
              ↓
            CLOSED
```

Invariant:

> HIGH-risk action never transitions directly from RISK_EVALUATED to EXECUTING.

## 3. Demo policy

Policy ID:

`REFUND_AFTER_48H_MAX_50`

```text
if orderAgeHours <= 48:
    maxRefund = paidAmount
else:
    maxRefund = paidAmount * 0.50
```

Risk:

```text
if requested <= 100 and requested <= maxRefund:
    LOW
elif requested <= maxRefund:
    MEDIUM
else:
    HIGH
```

Главный case:

```text
paidAmount = 850
requested = 850
age = 72h
maxRefund = 425
risk = HIGH
```

## 4. Data types

```ts
type RefundCase = {
  caseId: string;
  orderId: string;
  paidAmount: number;
  requestedAmount: number;
  orderAgeHours: number;
}

type RiskDecision = {
  level: "LOW" | "MEDIUM" | "HIGH";
  requestedAmount: number;
  policyMaximum: number;
  courtRequired: boolean;
  policyId: string;
  reason: string;
}
```

Risk Engine — обычный TypeScript. LLM не определяет числа, policy или risk class.

## 5. Actors

### HUMAN — `human_judge`
Имеет право approve / modify / reject / override.

### EXECUTOR — `executor_agent`
- формулирует proposed action;
- принимает решение;
- сообщает execution result.
Не отменяет Risk block самостоятельно.

### EVIDENCE — `evidence_agent`
- публикует policy/evidence;
- policy ID;
- computed maximum.
Не принимает решение.

### RISK — `risk_agent`
- сравнивает action с policy;
- публикует ALLOW/MODIFY/BLOCK.
Не выполняет action.

## 6. Intelligence strategy

### Canonical mode — deterministic

Роли генерируют сообщения из verified structured data + templates.

Плюсы:
- нет внешнего AI outage;
- предсказуемый demo;
- zero hallucination;
- low token burn;
- меньше credentials.

### Optional AI mode

После core PASS можно добавить один LLM call для natural language phrasing.

LLM получает:
- proposed action;
- verified policy;
- computed max;
- fixed risk result.

LLM не меняет факты/verdict. При ошибке — deterministic fallback.

## 7. Court protocol

### Executor

```text
[PROPOSAL]
Case: ORDER-303
Requested action: Refund €850
Reason: Customer cancellation request
```

Metadata:

```json
{
  "courtType": "proposal",
  "caseId": "ORDER-303",
  "requestedAmount": 850
}
```

### Evidence

```text
[EVIDENCE]
Policy REFUND_AFTER_48H_MAX_50:
after 48h, maximum refund is 50%.

Order age: 72h
Paid: €850
Maximum allowed: €425
```

### Risk

```text
[OBJECTION]
BLOCK €850.

Requested amount exceeds policy maximum by €425.
Recommended action: modify refund to €425.
```

### Human grammar

```text
APPROVE <amount>
REJECT
OVERRIDE <amount>: <reason>
```

UI button may send normal CometChat message `Approve €425`.

## 8. Decision parser

### APPROVE
If `amount <= policyMaximum` → valid.

If `amount > policyMaximum` → invalid, require OVERRIDE.

### REJECT
→ action blocked.

### OVERRIDE
Requires amount + non-empty reason.
Optional feature only.

## 9. Fail-closed rules

1. Group creation fails → no action.
2. Agent evidence messages fail → no action.
3. Human decision unrecognized → no action.
4. Approve above maximum without override → no action.
5. Refund API fails → no success state.

## 10. Load-bearing CometChat requirement

Правильный control loop:

```text
risk trigger
→ CometChat group created
→ agents publish messages
→ human publishes decision
→ app receives CometChat message
→ execution occurs
```

Недопустимо:

```text
app decides locally
+
CometChat merely mirrors transcript
```

Human decision must actually come from CometChat.

## 11. Group model

GUID:

`court-<order-id>-<short-random>`

Name:

`CASE #303 — Refund €850`

Metadata:

```json
{
  "caseId": "ORDER-303",
  "risk": "HIGH",
  "status": "WAITING_HUMAN",
  "policyId": "REFUND_AFTER_48H_MAX_50"
}
```

Members:
- human_judge
- executor_agent
- risk_agent
- evidence_agent

Для hackathon precreate identities. Не строить user lifecycle.

## 12. Message timing

Для визуального эффекта:

```text
t+0.0s Executor proposal
t+0.8s Evidence
t+1.6s Risk objection
```

Затем `WAITING FOR HUMAN DECISION`.

## 13. Receipt

```ts
type ExecutionReceipt = {
  receiptId: string;
  caseId: string;
  orderId: string;
  requestedAmount: number;
  executedAmount: number;
  preventedAmount: number;
  decision: "APPROVED" | "MODIFIED" | "REJECTED" | "OVERRIDDEN";
  approvedBy: string;
  policyId: string;
  riskLevel: "HIGH";
  courtGuid: string;
  humanDecisionMessageId?: number | string;
  override?: boolean;
  overrideReason?: string;
  executedAt: string;
}
```

Permanent DB не нужен.

## 14. Counterfactual

```text
withoutCourtAmount = requestedAmount
withCourtAmount = executedAmount
preventedAmount = withoutCourtAmount - withCourtAmount
```

Case C:

```text
WITHOUT COURT  €850
WITH COURT     €425
PREVENTED      €425
```

UI wording:

`Policy-violating amount prevented in this simulated case.`

## 15. UI logic

### Home
3 cards: €80 / €300 / €850.

### Court
Header:
`CASE #303 — HIGH RISK — ACTION PAUSED`

Side panel:
- amount;
- age;
- policy;
- max;
- status.

Right:
- actual CometChat conversation.

Buttons optional:
- Approve €425
- Reject

Buttons должны отправлять обычный CometChat message от human.

### Closed
Receipt + counterfactual.

## 16. Tests

T01: €80 / 12h → LOW, no court.  
T02: €850 / 72h → HIGH, max €425.  
T03: `Approve €425` → execute €425.  
T04: `Approve €850` → blocked.  
T05: garbage decision → no action.  
T06: CometChat error → no action.  
T07: refund API failure → FAILED_EXECUTION.

## 17. Главный automated invariant

> **No HIGH-risk action executes without a valid human decision received through the CometChat court.**

## 18. Не добавлять

- voice/video;
- real Stripe;
- CRM;
- customer data;
- RAG;
- embeddings;
- memory;
- Slack;
- email;
- production identity;
- multi-agent framework.

Если осталось время — улучшить demo, а не архитектуру.
