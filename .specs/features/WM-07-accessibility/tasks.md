# Tasks: Доступность

**Задача**: WM-07
**Спек**: `.specs/features/WM-07-accessibility/spec.md`
**План**: `.specs/features/WM-07-accessibility/plan.md`

> **Живой документ** — статусы и шаги обновляются по мере выполнения (можно дописывать
> новые шаги/фазы, всплывшие в процессе).

---

## Ф1: Контраст, лента для скринридера, фокус

- [x] токены палитры и семантики, рамка поля → `src/styles/tokens/`, `src/components/ui/Input/Input.module.scss`
- [x] миксин `visually-hidden` → `src/styles/mixins/_a11y.scss`
- [x] live-регион и направление сообщения → `src/pages/ChatPage/MessageList/`
- [x] плашка в постоянной позиции, `key` ленты → `src/pages/ChatPage/ChatPage.tsx`
- [x] фокус после «Назад» → `src/pages/ChatPage/ChatList/ChatList.tsx`
- [x] фокус при открытии чата и нажатии «Отправить» → `src/pages/ChatPage/MessageComposer/MessageComposer.tsx`
- [x] фокус при ошибках → `src/pages/LoginPage/LoginPage.tsx`, `src/pages/ChatPage/NewChatForm/NewChatForm.tsx`
- [x] тесты К2–К12 → `src/pages/ChatPage/__tests__/ChatPage.test.tsx`, `src/pages/LoginPage/__tests__/LoginPage.test.tsx`
- [x] ресёрч `code-quality`: §8 строки 6–8 (+ 8a), §9
- [x] ресёрч §7 — статус при слиянии (`/finish`)

## Тесты

- [x] Точечно: `npx vitest run <файл> --maxWorkers=2`, `npm run typecheck`, `npm run lint`
- [x] Полный прогон — **только в `/finish`** (`rules.md` §6):
      `npm run lint` + `npm run format:check` + `npm run build` + `npm run test:run -- --maxWorkers=2`

## Верификация

- [x] К1–К13 → доказательства (К1–К12 — в spec.md; К13 — `/finish`)
- [x] К14 — Диме (пройдено 2026-09-29): строки 6–8 §8 `code-quality`, регресс `max-chat` §6 (1, 5, 6, 8, 10, 11)
- [x] Статус `spec.md`: В РАБОТЕ → ЗАВЕРШЕНО

---

**Статусы**: ` ` не начато | `x` выполнено
**Правило**: обновлять статусы по мере выполнения
