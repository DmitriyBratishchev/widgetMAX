# Plan: Доступность

**Задача**: WM-07
**Ветка**: `feature/WM-07-accessibility`
**Уровень риска**: SAFE
**Спек**: `.specs/features/WM-07-accessibility/spec.md`
**Ресёрч**: `.research/code-quality/research.md` — §3.2, §7, §8 строки 6–8

> **Живой документ** — шаги/фазы дописываются **накопительно** (отмечать сделанное, не
> переписывать историю плана).

---

## Карта фаз

| Фаза | Цель | Трогает GREEN-API | Критерии | Статус |
|------|------|-------------------|----------|--------|
| **Ф1** | Контраст токенов, live-регион и направление в ленте, управление фокусом | нет | К1–К14 | **VERIFIED** (2026-09-29) |

---

## Ф1 — Контраст, лента для скринридера, фокус

### Шаги

1. `src/styles/tokens/_palette.scss`, `_semantic.scss` — токены по spec §1.
2. `src/components/ui/Input/Input.module.scss` — рамка `var(--color-input-border)`.
3. `src/styles/mixins/_a11y.scss` (новый) — `@mixin visually-hidden`.
4. `src/pages/ChatPage/MessageList/MessageList.tsx` + `.module.scss` — обёртка `.feed`
   `role="log" aria-live="polite"` (flex-колонка, `min-height: 0`; прокрутка остаётся на `<ol>`),
   `<span className={styles.direction}>` с текстом из `DIRECTION_LABELS`.
5. `src/pages/ChatPage/ChatPage.tsx` — плашка в постоянной позиции; `<MessageList key={chatId}>`.
6. `src/pages/ChatPage/ChatList/ChatList.tsx` — карта кнопок + эффект возврата фокуса.
7. `src/pages/ChatPage/MessageComposer/MessageComposer.tsx` — `ref` поля, фокус при монтировании и
   в `submit`.
8. `src/pages/LoginPage/LoginPage.tsx` — `name` у полей, `ref` формы, `flushSync` + фокус первого
   невалидного, `onError` → idInstance.
9. `src/pages/ChatPage/NewChatForm/NewChatForm.tsx` — то же для поля номера.
10. Тесты: `ChatPage.test.tsx` (describe «доступность»: К2–К9, К12), `LoginPage.test.tsx` (К10–К11).
11. Живые документы: spec/plan/tasks; ресёрч `code-quality` — §8 строки 6–8 уточнить, §9 — граница
    карточки поля ввода; при слиянии §7 → «в dev WM-07@2026-09-29».

### Ключевое решение фазы

Лента — `role="log"` на постоянной обёртке + `key={chatId}`, фокус — эффектами в компонентах, а не
через стор: это состояние DOM, не данные. Причины и таблица «событие → куда фокус» — spec §2, §4.

### Проверка Ф1 (DoD)

- **Команда**: `npx vitest run src/pages/ChatPage/__tests__/ChatPage.test.tsx src/pages/LoginPage/__tests__/LoginPage.test.tsx --maxWorkers=2`, `npm run typecheck`, `npm run lint`
- **Ожидаемый результат**: всё зелёное; новые тесты К2–К12 проходят; контраст — таблица spec (К1).

---

## Тесты

- [x] Точечно по ходу: `npx vitest run <файл> --maxWorkers=2`, `npm run typecheck`, `npm run lint`
- [x] Полный прогон — **только в `/finish`** (`rules.md` §6):
      `npm run lint` + `npm run format:check` + `npm run build` + `npm run test:run -- --maxWorkers=2`
