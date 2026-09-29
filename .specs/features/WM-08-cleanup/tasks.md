# Tasks: Чистка кода и тестов

**Задача**: WM-08
**Спек**: `.specs/features/WM-08-cleanup/spec.md`
**План**: `.specs/features/WM-08-cleanup/plan.md`

> **Живой документ** — статусы и шаги обновляются по мере выполнения (можно дописывать
> новые шаги/фазы, всплывшие в процессе).

---

## Ф1: Чистка кода и тестов

- [x] ветка `feature/WM-08-cleanup`, документы → `.specs/features/WM-08-cleanup/`
- [x] `cx`, `formatIsoDateTime`, `apiErrorText`, `message`, константы телефона (+ тесты) → `src/helpers/`
- [x] токен длительности, миксины `focus-ring`, `error-text`, `placeholder` → `src/styles/`
- [x] `Button`, `Input` на `ComponentProps`; `IconButton` + тест → `src/components/ui/`
- [x] страницы → `src/pages/ChatPage/**`, `src/pages/LoginPage/LoginPage.tsx`
- [x] `src/main.tsx`, `index.html`, `public/favicon.svg`
- [x] комментарии: `src/stores/chatStore.ts:55` + проход по `src/`
- [x] `src/test/fixtures.ts`, `renderHookWithQueryClient`, 13 тестовых файлов, опрос без `flush()`
- [x] новые тесты: IME-Enter, пустой номер, сброс ошибки входа
- [x] skill `frontend-patterns`; ресёрч `code-quality` §8 строка 10
- [x] приёмка эпика WM-05…WM-08 (headless + автоматика) → ресёрч `code-quality` §8; кольцо у ссылок (К20) → `src/styles/base/_global.scss`
- [x] ресёрч §7/§9/статус — при слиянии (`/finish`)

## Тесты

- [x] Точечно: `npx vitest run <файл> --maxWorkers=2`, `npm run typecheck`, `npm run lint`
- [x] Полный прогон — **только в `/finish`** (`rules.md` §6):
      `npm run lint` + `npm run format:check` + `npm run build` + `npm run test:run -- --maxWorkers=2`

## Верификация

- [x] К1–К18 → доказательства (К1–К18, К20 — «Итог» в spec.md и приёмка в ресёрче §8)
- [ ] К19 (не проверено — ждёт Диму) — Диме: регресс `max-chat` §6 (1, 5, 6, 8, 10, 11), `code-quality` §8 строки 6–8a и 10, консоль без 404 favicon
- [x] Статус `spec.md`: В РАБОТЕ → ЗАВЕРШЕНО

---

**Статусы**: ` ` не начато | `x` выполнено
**Правило**: обновлять статусы по мере выполнения
