# Tasks: Новый чат и отправка

**Задача**: WM-02
**Спек**: `.specs/features/WM-02-new-chat/spec.md`
**План**: `.specs/features/WM-02-new-chat/plan.md`

> **Живой документ** — статусы и шаги обновляются по мере выполнения.

---

## Ф1: данные

- [x] wire-типы → `src/types/greenApi.ts`
- [x] `checkAccount`, `sendMessage` → `src/services/chatService.ts`
- [x] телефон, время, тексты ошибок → `src/helpers/phone.ts`, `formatTime.ts`, `chatError.ts`
- [x] стор чатов → `src/stores/chatStore.ts`
- [x] хуки → `src/hooks/useCreateChat.ts`, `useSendMessage.ts`, `useSignOut.ts`
- [x] тесты: `src/helpers/__tests__/`, `src/services/__tests__/`, `src/stores/__tests__/`, `src/hooks/__tests__/`

## Ф1: UI

- [x] токены → `src/styles/tokens/`
- [x] UI → `src/pages/ChatPage/` (`NewChatForm`, `ChatList`, `MessageList`, `MessageComposer`)
- [x] тесты → `ChatPage.test.tsx`, `App.test.tsx`
- [x] headless-скриншоты

## Ф1: документы

- [x] ресёрч §5.2 / §6, skill `green-api`

## Тесты

- [x] Точечно: `npx vitest run <файл>`, `npx tsc -p tsconfig.app.json --noEmit`
- [x] Полный прогон — **только в `/finish`** (`rules.md` §6) — зелёный, 2026-09-29

## Верификация

- [x] К1–К12 → тесты + скриншоты
- [x] К13 → Дима на живом инстансе (чек-лист ресёрча §6) — 2026-09-29
- [x] К14 → тест `ChatPage.test.tsx` + Дима вживую (текст кнопки)
- [x] Статус `spec.md`: В РАБОТЕ → ЗАВЕРШЕНО

---

**Статусы**: ` ` не начато | `x` выполнено
