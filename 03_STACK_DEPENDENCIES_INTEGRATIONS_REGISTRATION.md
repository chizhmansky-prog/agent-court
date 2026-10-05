# Agent Court — стек, зависимости, интеграции и регистрация
## Zero to Chat / CometChat

## 1. Официальные условия

Официальная страница:
https://www.cometchat.com/hackathon

Проверено на 5 октября 2026:

- challenge открыт 24 сентября;
- закрывается 7 октября;
- winners — 9 октября;
- Top 3 получают 6 месяцев Claude Pro каждый;
- официальная страница также показывает `$1000 in CometChat credits`, но распределение credits сформулировано не идеально однозначно — не считать гарантированными $1000 каждому;
- valid entry должен реально работать;
- demo video < 90 секунд;
- official CometChat integration path должен быть видим и реально использован;
- существующий проект допускается;
- дополнительные libraries допускаются;
- free CometChat account покрывает 100 MAU;
- отдельной submission form нет, entries собираются через X;
- один entry на человека.

Judging:
1. It runs
2. It's interesting
3. It uses the MCP / official integration path

## 2. Рекомендуемый стек

### Runtime
**Node.js 20 LTS**

### Frontend/server
**Next.js App Router + TypeScript**

Причины:
- один repo;
- API routes для server secrets;
- простой Vercel deploy;
- быстрое demo UI.

### UI
React + минимальный CSS/Tailwind только если уже создан.

### CometChat

Официальный Skills path:

```bash
npx @cometchat/skills add
```

Provisioning:

```bash
npx @cometchat/skills-cli@3 auth login
npx @cometchat/skills-cli@3 provision run
```

Основной web package по текущей документации:
`@cometchat/chat-uikit-react`

Текущие peer requirements в Next.js docs:
- React >=18
- ReactDOM >=18
- rxjs ^7.8.1

**Не pin-ить major UI Kit вручную до Skills.** Использовать current verified bundle.

### Tests
`vitest`

### Deploy
Vercel — рекомендовано, не обязательно конкурсом.

## 3. Внешний AI

Core **не зависит** от OpenAI/Anthropic.

Optional:
- один server-side LLM call;
- только wording;
- facts/verdict immutable;
- deterministic fallback.

Если AI создаёт instability — удалить.

## 4. CometChat identities

Precreate:

```text
human_judge     Human Approver
executor_agent  Executor Agent
risk_agent      Risk Agent
evidence_agent  Evidence Agent
```

### Human
Browser session login as `human_judge`.

Предпочтительный путь:
- server-side auth token;
- secret не отдавать browser.

### Agents
Messages отправлять server-side через CometChat REST messaging от соответствующего UID.

Текущий REST reference поддерживает send-message «on behalf of a user». Точный актуальный endpoint/header shape перед coding подтвердить через установленный CometChat Skills/live docs.

## 5. Используемые CometChat capabilities

Required:
- init;
- login;
- create group;
- add/create members;
- group chat;
- send messages;
- realtime incoming messages;
- history;
- agent identities.

Optional:
- message metadata;
- group metadata/tags.

Не используем:
- calling;
- push;
- reactions;
- moderation;
- threaded messages.

## 6. Регистрация и настройка

### 6.1 CometChat account

Открыть:
https://app.cometchat.com

Создать free account. Card не нужна.

### 6.2 App

Имя:
`Agent Court`

Сохранить:
- App ID
- Region
- server-side REST/API credential

### 6.3 Новый repo/project

```bash
npx create-next-app@latest agent-court --typescript
cd agent-court
```

### 6.4 Skills

```bash
npx @cometchat/skills add
```

Проверить, что Codex видит CometChat skill.

### 6.5 CLI auth

```bash
npx @cometchat/skills-cli@3 auth login
```

### 6.6 Provision

```bash
npx @cometchat/skills-cli@3 provision run
```

### 6.7 Tests dependency

```bash
npm install -D vitest
```

### 6.8 Demo users

Создать через Dashboard или маленький setup script:
- human_judge
- executor_agent
- risk_agent
- evidence_agent

Не строить UI регистрации.

### 6.9 Smoke test

До Agent Court logic:

```text
human login
→ create group
→ add members
→ human sends message
→ message appears realtime
→ server sends one message as executor_agent
```

Если последний пункт не работает — не продолжать product layer.

## 7. Environment

`.env.example`:

```bash
NEXT_PUBLIC_COMETCHAT_APP_ID=
NEXT_PUBLIC_COMETCHAT_REGION=

# SERVER ONLY
COMETCHAT_REST_API_KEY=

# OPTIONAL
OPENAI_API_KEY=
```

Если Skills создаёт другие official variable names — использовать их.

Rules:
- App ID/Region may be public;
- REST key server-only;
- OpenAI key server-only.

Перед commit:

```bash
git status
git grep -n "sk-"
git grep -n "COMETCHAT_REST"
git grep -n "API_KEY"
```

## 8. Next.js integration rule

Текущая CometChat documentation указывает:
- SDK/UI Kit использует browser APIs;
- Next.js integration должна грузиться client-side;
- порядок init → login → render;
- SSR pattern должен соответствовать current Skills bundle.

Не писать старый workaround вручную — следовать Skills-generated integration.

## 9. Server routes

### `/api/cometchat/token`
Server-side auth token для human.

### `/api/court/agent-message`

Input:

```json
{
  "guid": "...",
  "actor": "risk_agent",
  "text": "...",
  "metadata": {}
}
```

Whitelist:
- executor_agent
- risk_agent
- evidence_agent

Не принимать произвольный UID.

### `/api/refund`

Simulated only.

Input:

```json
{
  "caseId": "ORDER-303",
  "amount": 425,
  "decisionMessageId": "..."
}
```

Output:

```json
{
  "status": "executed",
  "receiptId": "rcpt_...",
  "executedAmount": 425
}
```

Никакого Stripe/банка.

## 10. GitHub

Repo:
`agent-court`

Перед submission сделать **PUBLIC**.

README top:

```text
# Agent Court
Before an autonomous agent acts, it may have to defend the action.

Zero to Chat 2026 submission.
Built with CometChat Skills.
```

README:
- screenshot/GIF;
- problem;
- demo flow;
- why CometChat is load-bearing;
- architecture;
- setup;
- env;
- live URL;
- demo video;
- note: simulated refunds only.

## 11. Deployment

Vercel recommended.

Перед deploy:

```bash
npm run lint
npm test
npm run build
```

Env vars — через Vercel settings.

Production smoke test in incognito:

```text
open URL
→ human login
→ run €850 case
→ court
→ 3 agent messages
→ human approves €425
→ receipt
```

## 12. Submission через X

Нужен рабочий X account.

Официальная submission схема:
- найти official Zero to Chat thread с CometChat challenge page;
- quote-tweet;
- attach video <90s;
- tag `@CometChat`;
- use `#ZeroToChat`;
- добавить public repo link.

На официальной странице есть небольшая неоднозначность: один блок говорит code link optional if public, другой просит demo + repo. Для максимума шансов:
**public repo link обязателен по нашему внутреннему правилу.**

## 13. Внутренний дедлайн

Официальный close: **7 октября 2026**.

Точное время cutoff на основной странице явно не указано.

Внутренний deadline:
**6 октября 2026, 18:00 Europe/Riga**

К этому моменту:
- code frozen;
- repo public;
- production tested;
- video exported;
- tweet ready.

## 14. Submission evidence

Сохранить:

```text
submission/
├─ tweet-url.txt
├─ final-video.mp4
├─ final-commit.txt
├─ screenshot-submission.png
└─ README snapshot
```

Commit:

```bash
git rev-parse HEAD
```

## 15. Integration risks

| Риск | Вероятность | Влияние | Mitigation |
|---|---:|---:|---|
| Next.js SSR + CometChat | средняя | высокая | official Skills bundle |
| Send agent messages as distinct identities | средняя | высокая | REST server-side; проверить первым |
| Secret leak | низкая | высокая | server env only |
| Human command parsing | средняя | высокая | narrow grammar + buttons |
| External LLM outage | нулевая для core | низкая | deterministic core |
| Deploy issue | средняя | средняя | record demo early |
| Submission ambiguity | низкая | высокая | public repo + exact tags + screenshot |

## 16. Gate 0

В первые 60 минут:

```text
Skills installed                       PASS
Free app provisioned                   PASS
Human logged in                        PASS
Group created                          PASS
4 demo users exist                     PASS
Human message realtime                 PASS
Server sends message as agent UID      PASS
```

Без последнего PASS не строить остальное.

## 17. Stack snapshot

```text
Codex
  ↓
CometChat Skills
  ↓
Next.js + TypeScript
  ↓
CometChat UI Kit / JS SDK
  ├─ group
  ├─ realtime messages
  ├─ human
  └─ agent identities
  ↓
Next.js server routes
  ├─ CometChat REST
  └─ simulated refund
  ↓
Deterministic Risk Engine
  ↓
Receipt UI
  ↓
Vercel
```

External AI provider: **not required**.

## 18. Reference links

Zero to Chat:
https://www.cometchat.com/hackathon

CometChat Skills:
https://www.cometchat.com/blog/cometchat-skills

Agent Chat Skills:
https://www.cometchat.com/agent-chat-skills

Next.js integration:
https://www.cometchat.com/docs/ui-kit/react/next-js-integration

MCP docs:
https://www.cometchat.com/docs/mcp-server

Create group:
https://www.cometchat.com/docs/sdk/javascript/create-group

Add members:
https://www.cometchat.com/docs/sdk/javascript/group-add-members

Join group:
https://www.cometchat.com/docs/sdk/javascript/join-group

REST Send Message:
https://api-explorer.cometchat.com/reference/send-message
