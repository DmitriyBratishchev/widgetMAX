# Plan: Чистка кода и тестов

**Задача**: WM-08
**Ветка**: `feature/WM-08-cleanup`
**Уровень риска**: SAFE
**Спек**: `.specs/features/WM-08-cleanup/spec.md`
**Ресёрч**: `.research/code-quality/research.md` — §3.3, §3.4, §2.5, §7, §9

> **Живой документ** — шаги/фазы дописываются **накопительно** (отмечать сделанное, не
> переписывать историю плана).

---

## Карта фаз

| Фаза | Цель | Трогает GREEN-API | Критерии | Статус |
|------|------|-------------------|----------|--------|
| **Ф1** | Дубли текстов, литералов и SCSS, `cx`, `IconButton`, кит на `ComponentProps`, фикстуры и хелперы тестов, favicon | нет | К1–К20 | **VERIFIED** (2026-09-30), К19 ждёт Диму |

---

## Ф1 — Чистка кода и тестов

### Шаги

1. Хелперы (+ unit-тесты): `helpers/cx.ts`, `formatIsoDateTime` в `formatTime.ts`,
   `helpers/apiErrorText.ts`, `helpers/message.ts`, константы в `phone.ts`; `chatError.ts` и
   `signInError.ts` — на константы.
2. Стили: `--duration-fast` в `tokens/_scale.scss`; `focus-ring` в `mixins/_a11y.scss`;
   `mixins/_feedback.scss` (`error-text`, `placeholder`).
3. Кит: `Button`/`Input` → `ComponentProps` + `cx` + миксины; `Avatar` → `cx`; новый
   `components/ui/IconButton/` (tsx, scss, `__tests__`).
4. Страницы: `ChatPage` («Назад» → `IconButton` в обёртке `.back`, плашки на миксинах);
   `MessageComposer` (`IconButton`, без `.row .send`/`.icon`, константа, `error-text`);
   `MessageList`/`ChatList` (`cx`, `formatIsoDateTime`); `NewChatForm` (`phoneRef`, текст из
   констант); `LoginPage` (`ref` на поля, `signIn.reset()` в `handleChange`).
5. `main.tsx` — явная проверка `#root`; `index.html` + `public/favicon.svg`.
6. Комментарии: `chatStore.ts:55`; проход по комментариям `src/` — только неверные по смыслу.
7. Тесты: `src/test/fixtures.ts`; `renderHookWithQueryClient`; 13 файлов на фикстуру; опрос —
   константы и `vi.waitFor` / `advanceTimersByTimeAsync` вместо `flush()`; новые тесты (IME,
   пустой номер, сброс ошибки входа). *Уточнено по ходу:* опрос — целиком на фейковых таймерах, шаг — `settle()`
   (`advanceTimersByTimeAsync(0)`), без `vi.waitFor` — причины в spec §«Решение» п. 9.
8. Живые документы: skill `frontend-patterns` (кит, стили, тесты); ресёрч `code-quality` §8 —
   строка 10 (сброс ошибки входа).
9. Точечные прогоны → `/task-check` (по желанию) → `/finish`.

### Ключевое решение фазы

Константы и тексты — у владельца правила (`phone.ts`, `message.ts`, `apiErrorText.ts`), а не у
первого потребителя; кит принимает `ref` через `ComponentProps`, поэтому фокус в формах — через
`ref`. Остальные решения и причины — spec §«Решение».

### Проверка Ф1 (DoD)

- **Команда**: grep и тесты К1–К17 (`spec.md`); `npm run typecheck`; `npm run lint`;
  в `/finish` — `npm run lint && npm run format:check && npm run build && npm run test:run -- --maxWorkers=2`
- **Ожидаемый результат**: всё зелёное, grep «после» — как в критериях; `dist/favicon.svg` есть.

### При `/finish` (последняя задача эпика)

Ресёрч `code-quality`: §7 WM-08 → «в dev WM-08@2026-09-29», статус → `archived`, §9 — пункт про
`flush()` закрыть; `spec.md` → ЗАВЕРШЕНО; карта фаз → VERIFIED. ✅ 2026-09-30: lint 0, format:check
чисто, build — 107 модулей, test:run — 21 файл, 190 passed.

---

## Тесты

- [x] Точечно по ходу: `npx vitest run <файл> --maxWorkers=2`, `npm run typecheck`, `npm run lint`
- [x] Полный прогон — **только в `/finish`** (`rules.md` §6):
      `npm run lint` + `npm run format:check` + `npm run build` + `npm run test:run -- --maxWorkers=2`
