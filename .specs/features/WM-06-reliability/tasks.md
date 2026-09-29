# Tasks: Надёжность

**Задача**: WM-06
**Спек**: `.specs/features/WM-06-reliability/spec.md`
**План**: `.specs/features/WM-06-reliability/plan.md`

> **Живой документ** — статусы и шаги обновляются по мере выполнения (можно дописывать
> новые шаги/фазы, всплывшие в процессе).

---

## Ф1: Надёжность

- [x] ветка `feature/WM-06-reliability`, перенос spec/plan/tasks в `.specs/features/WM-06-reliability/`
- [x] транспорт: `kind: 'response'`, `nullable`, таймаут → `src/api/greenApiClient.ts` + тест
- [x] сервис опроса: `nullable`, `timeoutMs` → `src/services/notificationService.ts` + тест
- [x] разбор уведомлений без прототипа → `src/helpers/notification.ts` + тест
- [x] гонка выхода → `src/stores/sessionStore.ts`, `src/helpers/chatError.ts`, `src/hooks/useCreateChat.ts`, `src/hooks/useSendMessage.ts` + тесты
- [x] остановка опроса → `src/hooks/useNotificationPolling.ts` + тест
- [x] плашка и `readOnly` → `src/pages/ChatPage/ChatPage.tsx`, `ChatPage.module.scss`, `MessageComposer/MessageComposer.tsx` + `ChatPage.test.tsx`
- [x] документы:
  - [x] `.research/max-chat/research.md` §5.3, §5.4 — решение «ошибки опроса в UI не показываем» пересмотрено в WM-06
  - [x] skill `green-api` §2 (транспорт: `nullable`, таймаут) и §3 (остановка цикла на 401/403 и ошибке кода)
  - [x] skill `frontend-patterns` §«Что где живёт» — причина остановки опроса из хука
  - [x] `.research/code-quality/research.md` §8 строки 3 и 5, §3.4 «не покрыто»
  - [x] там же §7 — статус при слиянии (`/finish`)

## Тесты

- [x] Точечно: `npx vitest run <файл>`, `npm run typecheck`, `npm run lint`
- [x] Полный прогон — **только в `/finish`** (`rules.md` §6):
      `npm run lint` + `npm run format:check` + `npm run build` + `npm run test:run`

## Верификация

- [x] К1–К12 → точечные прогоны (9 файлов, 100 тестов, `--maxWorkers=2`), typecheck, lint; К13 — `/finish`
- [ ] Диме на живом инстансе: строки 3–5 §8 `code-quality` — пройдены 2026-09-29; регресс `max-chat` §6 — ждёт
- [x] Статус `spec.md`: В РАБОТЕ → ЗАВЕРШЕНО

---

**Статусы**: ` ` не начато | `x` выполнено
**Правило**: обновлять статусы по мере выполнения
