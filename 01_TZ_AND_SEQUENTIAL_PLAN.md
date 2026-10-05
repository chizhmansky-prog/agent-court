# Agent Court — ТЗ + подробный последовательный план
## Zero to Chat / CometChat — конкурсная версия

**Статус:** build-ready specification  
**Цель:** собрать максимально запоминающийся, но технически маленький submission для Zero to Chat.  
**Внутренний лимит:** 3–4 часа разработки, hard stop 5 часов.  
**Принцип:** CometChat — ключевой runtime продукта, а не декоративный чат.

## 1. Что строим

**Agent Court** — временная live-комната, которая автоматически создаётся перед рискованным или необратимым действием AI/automation-агента.

Обычная схема:

`Agent → Tool → Done`

Agent Court:

`Agent → Risk Gate → Court → Evidence + Objection + Human Decision → Execute/Modify/Reject → Receipt`

### Главный demo-case

Агент хочет выполнить:

> Refund customer €850

Policy говорит:

> После 48 часов максимальный refund = 50%.

Система определяет высокий риск, создаёт отдельную CometChat room и автоматически добавляет участников:

- Executor Agent
- Risk Agent
- Evidence Agent
- Human Approver

В комнате появляется:

- запрос Executor;
- найденная policy Evidence Agent;
- objection от Risk Agent;
- решение человека.

Human пишет:

> Approve €425

После этого action исполняется, а на экране появляется итог:

- Requested: €850
- Approved: €425
- Prevented: €425
- Evidence: verified
- Human approval: recorded
- Action receipt: generated

**WOW-момент:** chat room становится временным «судом» над действием автономного агента.

## 2. Почему это может выиграть

Zero to Chat официально оценивает очень просто:

1. приложение реально работает;
2. идея интересная и неожиданная;
3. CometChat connector/skills реально использовались в build.

Agent Court закрывает все три пункта:

- chat создаётся динамически;
- CometChat является центральным механизмом решения;
- human-in-the-loop не является обычным support handoff;
- есть видимый конфликт между агентами;
- решение человека немедленно меняет последующее действие;
- результат измерим и понятен за 20–30 секунд.

## 3. Scope

### Обязательно

1. Главный экран с тремя demo actions:
   - low risk: refund €80;
   - medium: refund €300;
   - high risk: refund €850.
2. Детерминированный risk engine.
3. Low-risk действие исполняется без Court.
4. High-risk действие вызывает Court.
5. При Court создаётся новая CometChat group.
6. В group присутствуют 4 роли:
   - Human
   - Executor
   - Risk
   - Evidence
7. Agent messages реально появляются в CometChat.
8. Human отправляет approval/rejection через CometChat.
9. Решение из чата влияет на выполнение действия.
10. Финальный execution receipt.
11. Counterfactual card: что произошло бы без Court.
12. Видео < 90 секунд.
13. Видно, что использовались CometChat Skills/connector.

### Не строить

- настоящий payment provider;
- настоящие refunds;
- database;
- auth системы продукта;
- billing;
- voice/video;
- RAG;
- vector DB;
- n8n;
- Hermes;
- multi-agent framework;
- полноценный CRM;
- production-grade policy engine;
- mobile app;
- Kubernetes;
- long-running autonomous agents.

Все финансовые действия в demo — симуляция.

## 4. Технический результат

Репозиторий:

```text
agent-court/
├─ app/
│  ├─ page.tsx
│  ├─ court/[caseId]/page.tsx
│  └─ api/
│     ├─ cometchat/token/route.ts
│     ├─ court/agent-message/route.ts
│     └─ refund/route.ts
├─ components/
│  ├─ ActionCard.tsx
│  ├─ RiskBadge.tsx
│  ├─ CourtPanel.tsx
│  ├─ ReceiptCard.tsx
│  └─ CounterfactualCard.tsx
├─ lib/
│  ├─ risk-engine.ts
│  ├─ policies.ts
│  ├─ court-protocol.ts
│  ├─ cometchat-server.ts
│  └─ demo-cases.ts
├─ tests/
│  └─ risk-engine.test.ts
├─ public/
├─ README.md
├─ .env.example
└─ package.json
```

Не создавать новые каталоги без необходимости.

## 5. Demo cases

### Case A — Low Risk

```text
order: ORDER-101
requested refund: €80
age: 12h
policy maximum: €80
risk: LOW
expected result: auto execute
```

UI: `LOW RISK → EXECUTED`

Court не создаётся.

### Case B — Medium

```text
order: ORDER-202
requested refund: €300
age: 36h
policy maximum: €300
risk: MEDIUM
expected result: agent review
```

Можно использовать только как дополнительную карточку. Не обязательно показывать в видео.

### Case C — High Risk / главный demo

```text
order: ORDER-303
requested refund: €850
age: 72h
policy:
after 48h max refund = 50%
maximum permitted = €425
risk: HIGH
expected result: Agent Court
```

## 6. Court flow

1. Пользователь нажимает `RUN AGENT`.
2. Risk Engine получает Case C.
3. Возвращает HIGH / courtRequired=true / policyMaximum=425.
4. UI показывает `HIGH RISK — COURT REQUIRED`.
5. Создаётся CometChat group `court-order-303-<short-id>`.
6. В group добавляются `human_judge`, `executor_agent`, `risk_agent`, `evidence_agent`.
7. Сообщения публикуются с короткой задержкой:
   - Executor: запрос €850;
   - Evidence: policy + maximum €425;
   - Risk: BLOCK €850, recommend €425.
8. Human отправляет `Approve €425`.
9. Приложение распознаёт решение и вызывает simulated refund endpoint.
10. Executor публикует `ACTION EXECUTED — €425`.
11. UI показывает receipt и counterfactual.

Receipt:

```json
{
  "status": "executed",
  "orderId": "ORDER-303",
  "requested": 850,
  "executed": 425,
  "prevented": 425,
  "approvedBy": "human_judge",
  "policy": "REFUND_AFTER_48H_MAX_50",
  "receiptId": "rcpt_..."
}
```

## 7. Optional WOW+ feature

Только если core полностью работает и осталось >= 30 минут.

### Human override

Human пишет:

> Approve full €850

Risk Agent:

> Override conflicts with policy. Provide an explicit override reason.

Human:

> Override: VIP retention exception

Система сохраняет override и explicit reason.

**Не делать**, если core не завершён.

## 8. UX

Header:

```text
AGENT COURT
Before an autonomous agent acts, it may have to defend the action.
```

Главный визуальный контраст:

```text
LOW RISK → EXECUTE
HIGH RISK → CONVENE COURT
```

Court view:
- слева case summary;
- справа настоящий CometChat chat;
- сверху risk state;
- после решения — receipt + counterfactual.

## 9. Детальный план сборки

### PHASE 0 — Регистрация и credentials
**Target: 20–30 минут**

- зарегистрироваться в CometChat;
- создать free app;
- получить App ID, Region и server-side credentials;
- установить CometChat Skills;
- provision credentials;
- создать GitHub repo.

**Gate:** sample group chat должен загрузиться.

### PHASE 1 — Vertical Slice
**Target: 45–60 минут**

```text
Next.js
→ CometChat init
→ human login
→ create test group
→ human can send/receive group message
```

**HARD GATE:** если через 60 минут group chat не работает — исправлять только integration.

### PHASE 2 — Court Creation
**Target: 30–40 минут**

- demo cases;
- risk engine;
- high-risk trigger;
- unique group;
- members.

Gate: `high risk → group created → court page opens`.

### PHASE 3 — Agent Messages
**Target: 30–40 минут**

Server-side отправляет сообщения от:
- executor_agent;
- evidence_agent;
- risk_agent.

Gate: три сообщения отображаются как разные участники.

### PHASE 4 — Human Decision → Action
**Target: 30–45 минут**

Human пишет `Approve €425`.

Приложение:
- получает message;
- валидирует сумму;
- вызывает simulated refund;
- публикует execution message;
- показывает receipt.

Gate: полный end-to-end flow.

### PHASE 5 — Counterfactual + Polish
**Target: 20–30 минут**

Добавить:

```text
WITHOUT AGENT COURT
€850 executed
Policy violation

WITH AGENT COURT
€425 executed
€425 prevented
```

Только hierarchy, state transitions, avatars/icons, risk badge, receipt.

### PHASE 6 — Tests + Failure Modes
**Target: 20–30 минут**

Минимум:
1. €80 → LOW.
2. €850 / 72h → HIGH.
3. maximum = €425.
4. approval > maximum без override → rejected.
5. malformed approval → no execution.
6. CometChat failure → action remains blocked.

**Fail closed:** если Court/chat ломается — refund не выполняется.

### PHASE 7 — Deployment
**Target: 15–30 минут**

Предпочтительно Vercel.

Проверить:
- secrets server-side;
- production CometChat;
- realtime human reply;
- receipt flow.

### PHASE 8 — Видео
**Target: 30–40 минут**

Продолжительность: 70–85 секунд.

Script:

**0–7 sec**  
`AI agents can act. But who stops them when they're wrong?`

**7–15 sec**  
Agent attempts `Refund €850`.

**15–20 sec**  
`HIGH RISK — COURT CONVENED`

**20–40 sec**  
CometChat group: Executor → Evidence → Risk.

**40–52 sec**  
Human: `Approve €425`

**52–60 sec**  
Execution + receipt.

**60–72 sec**  
Counterfactual.

**72–80 sec**  
Показать editor/terminal с `npx @cometchat/skills add`.

**80–85 sec**  
`Agent Court — Give autonomous agents somewhere to be challenged.`

Не объяснять архитектуру голосом дольше нескольких секунд.

## 10. Submission

Перед публикацией:
- app runs;
- video < 90 sec;
- CometChat visible;
- Skills/connector visible;
- repo clean;
- no secrets;
- README complete.

Для максимальной процедурной безопасности repo сделать public.

X submission:
- quote-tweet official challenge thread;
- attach demo video;
- link public repo;
- tag `@CometChat`;
- hashtag `#ZeroToChat`.

**Внутренний дедлайн: 6 октября 2026, 18:00 Europe/Riga.**

Сохранить:
- tweet URL;
- screenshot;
- video;
- final commit SHA.

## 11. Definition of Done

```text
REGISTRATION
CometChat free account                PASS
Zero to Chat rules checked           PASS

COMETCHAT
Skills installed                     PASS
App credentials                      PASS
Human login                          PASS
Group creation                       PASS
4 users visible                      PASS
Agent messages                       PASS
Human message                        PASS
Realtime update                      PASS

PRODUCT
Risk engine                          PASS
Low-risk bypass                      PASS
High-risk court                      PASS
Policy evidence                      PASS
Human approval                       PASS
Modified action execution            PASS
Receipt                              PASS
Counterfactual                       PASS
Fail-closed on chat failure          PASS

DELIVERY
Production/demo URL                  PASS
Public repo                          PASS
README                               PASS
No secrets                           PASS
<90 sec video                        PASS
CometChat integration shown          PASS
X submission                         PASS
@CometChat                           PASS
#ZeroToChat                          PASS
```

## 12. Stop rules

Hard stop = **5 часов total build time**.

Если после 60 минут нет working CometChat group chat:
- не добавлять AI;
- не добавлять UI polish;
- исправлять только integration.

Если после 3 часов нет:

`high-risk → room → agent messages → human response → action`

урезать всё, кроме этого flow.

Если external AI ломает demo:
- выключить;
- deterministic court остаётся canonical.

**Надёжный working demo важнее количества AI.**
