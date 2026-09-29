# Tasks: Приём сообщений

**Задача**: WM-03
**Спек**: `.specs/features/WM-03-receive-messages/spec.md`
**План**: `.specs/features/WM-03-receive-messages/plan.md`

> **Живой документ** — статусы и шаги обновляются по мере выполнения.

---

## Ф1: данные

- [x] транспорт `query` / `pathSuffix` → `src/api/greenApiClient.ts` + тесты
- [x] wire-типы → `src/types/greenApi.ts`; `receiveNotification`, `deleteNotification` → `src/services/notificationService.ts` + тесты
- [x] разбор уведомления → `src/helpers/notification.ts` + тесты

## Ф1: цикл и UI

- [x] цикл опроса → `src/hooks/useNotificationPolling.ts` + тесты (порядок, чужие, эхо, abort, StrictMode, backoff)
- [x] подключение к `src/pages/ChatPage/ChatPage.tsx`, моки в `ChatPage.test.tsx` / `App.test.tsx`, тест К9

## Ф1: документы

- [x] README, ресёрч §5.3 / §6, skill `green-api` §2–§3

## Тесты

- [x] Точечно: `npx vitest run <файл>`, `npx tsc -p tsconfig.app.json --noEmit`
- [x] Полный прогон — **только в `/finish`** (`rules.md` §6)

## Верификация

- [x] К1–К9, К11 → тесты
- [x] К10 → Дима на живом инстансе (чек-лист ресёрча §6, открытые вопросы §2.4)
- [x] Статус `spec.md`: В РАБОТЕ → ЗАВЕРШЕНО

---

**Статусы**: ` ` не начато | `x` выполнено
