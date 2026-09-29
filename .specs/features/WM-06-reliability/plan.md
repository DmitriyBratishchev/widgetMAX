# Plan: Надёжность

**Задача**: WM-06
**Ветка**: `feature/WM-06-reliability`
**Уровень риска**: CAUTION
**Спек**: `.specs/features/WM-06-reliability/spec.md`
**Ресёрч**: `.research/code-quality/research.md`

> **Живой документ** — шаги/фазы дописываются **накопительно** (отмечать сделанное, не
> переписывать историю плана).

---

## Карта фаз

| Фаза | Цель | Трогает GREEN-API | Критерии | Статус |
|------|------|-------------------|----------|--------|
| **Ф1** | Гонка выхода, остановка опроса и плашка, транспорт, разбор уведомлений, поле во время отправки | да | К1–К14 | **VERIFIED** (2026-09-29) |

---

## Ф1 — Надёжность

### Шаги

Снизу вверх по слоям:

1. `src/api/greenApiClient.ts` — `kind: 'response'`, опции `nullable` и `timeoutMs`
   (`REQUEST_TIMEOUT_MS = 30_000`), актуальная причина у отключения `no-unsafe-type-assertion`;
   тесты транспорта.
2. `src/services/notificationService.ts` — `nullable: true`, `timeoutMs` = long-poll + 10 с; тест.
3. `src/helpers/notification.ts` — направление через `switch`; тест на имена из прототипа.
4. `src/stores/sessionStore.ts` — `isCurrentSession`; `src/helpers/chatError.ts` —
   `SessionEndedError`; `useCreateChat.ts`/`useSendMessage.ts` — сверка сессии после `await`;
   тесты гонки (стор + `readPersistedState`).
5. `src/hooks/useNotificationPolling.ts` — `PollingStopReason`, разбор ошибки, колбэк остановки,
   причина из хука; тесты 401/403/500/`TypeError`/новая сессия.
6. `src/pages/ChatPage/ChatPage.tsx` + `.module.scss` — плашка на токенах (как `.error` в
   `MessageComposer`); `MessageComposer.tsx` — `readOnly`; тесты `ChatPage`.
7. Документы: ресёрчи, skills (см. `tasks.md`).

### Ключевое решение фазы

Защита от гонки — сверка объекта `credentials` после ответа, а не отмена запроса; признак
остановки опроса — возвращаемое значение хука, а не стор; таймаут транспорта 30 с (receive —
long-poll + 10 с) и считается ошибкой сети; поле во время отправки — `readOnly`. Причины — `spec.md`
§«Решение».

### Проверка Ф1 (DoD)

- **Команда**: `npx vitest run src/api src/services src/helpers/__tests__/notification.test.ts src/hooks src/pages/ChatPage` + `npm run typecheck` + `npm run lint`
- **Ожидаемый результат**: все тесты зелёные, typecheck и lint без ошибок и предупреждений

---

## Тесты

- [x] Точечно по ходу: `npx vitest run <файл>`, `npm run typecheck`, `npm run lint`
- [x] Полный прогон — **только в `/finish`** (`rules.md` §6):
      `npm run lint` + `npm run format:check` + `npm run build` + `npm run test:run`
