# Agent Court — план завершения и контракт проверки

Дата: 2026-10-05, Europe/Riga. Исходники прочитаны полностью: 01, 02, 03.

## MISSION / AUTHORITY
Завершить конкурсный MVP по трём исходным спецификациям. Они остаются источником требований. Этот файл фиксирует порядок и evidence, не заменяет ТЗ. Финансовые действия только simulated. Реальный CometChat обязателен.

## VERIFIED BASELINE
В исходной папке только три Markdown-файла, код отсутствовал. Активной browser-сессии CometChat и CometChat env variables не обнаружено. 2026-10-05 app.cometchat.com перенаправил на signup/login. Предыдущих PASS нет.

## INVARIANTS
- HIGH не исполняется без валидного human_judge message из текущей CometChat court.
- Policy и risk рассчитываются детерминированно сервером; деньги — integer cents.
- Browser payload, text, amount, actor и metadata не являются authority.
- Ошибка chat/evidence/decision сохраняет блокировку; refund failure не создаёт success.
- Повторное решение не создаёт повторное исполнение. Потеря runtime state блокирует action.
- REST key остаётся server-only. Optional override/LLM исключены из core.

## PHASES
1. **Gate 0 / integration only.** Установить официальные CometChat Skills в agent-court; Next.js App Router scaffold; server token + bounded setup; browser init→login→group→history/realtime; server agent message. Доказать четыре identities, actual human incoming message и distinct server agent sender. До этого product layer не строить (03 §6.9, §16).
2. **Core vertical slice.** Canonical case registry; HIGH group; three templates; WAITING_HUMAN; CometChat read-back sender/group/current-run/message freshness; narrow approval/reject grammar; single terminal transition and simulated receipt. LOW bypass; MEDIUM paused REVIEW.
3. **Verification.** Independent audit separated from implementation. Positive and negative probes below; lint/test/build; actual browser runtime; secret scan and fresh read-back.
4. **Demo delivery.** Court UI, receipt/counterfactual; README; actual 70–85s video; deployment and production smoke; public repository.
5. **Submission.** Review exact tweet/video/repo, then publish with explicit authorization. Preserve actual tweet URL, screenshot, video, final SHA. Do not invent delivery evidence.

## POSITIVE / NEGATIVE PROBES
| Claim | Positive expected result | Negative expected result |
|---|---|---|
| Risk | €80/12h LOW; €850/72h HIGH, max €425 | Invalid/nonfinite/nonpositive inputs rejected |
| Human authority | current human_judge Approve €425 from court → one €425 receipt | wrong sender/group, forged browser amount/text, stale/replayed ID → zero execution |
| Policy | Approve €425 accepted | Approve €850 or malformed grammar → zero execution |
| State | evidence complete then WAITING_HUMAN | early decision, missing evidence, duplicate/concurrent decision → no unauthorized execution |
| Fail closed | healthy CometChat exchange completes | group/evidence/chat error → blocked; refund error → FAILED_EXECUTION without success |
| Secrets | app ID/region browser-visible, key server-only | REST key in source/client/build output → release blocked |

## FAILURE / STOP
Missing credentials or login: report gate; finish safe integration preparation, no fictional core PASS. After 60 minutes without working group chat, integration only. After 3 hours without full core flow, cut optional scope. Hard stop 5 hours. Publishing, spending, destructive operations and real communications require their applicable explicit authorization.

## EXACT OUTPUT CONTRACT / DoD
Deliver source paths, commands and actual results, runtime artifacts, independent findings, open blockers and FINAL_STATUS. Full COMPLETE only if original DoD—including actual chat/runtime, URL, public repo, video and X submission—is evidenced. Local build/test success is not integration PASS.

## STATUS
Gate 0 actual PASS: reports/GATE0_EVIDENCE.md. Account/app provisioned EU; SDK human message4 and incoming executor message5 validated through real CometChat. Core product implementation and independent audit in progress.
