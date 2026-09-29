# Tasks: Вход и сессия

**Задача**: WM-01
**Спек**: `.specs/features/WM-01-login/spec.md`
**План**: `.specs/features/WM-01-login/plan.md`

> **Живой документ** — статусы и шаги обновляются по мере выполнения.

---

## Ф1: данные — сделано

- [x] wire-типы → `src/types/greenApi.ts`
- [x] транспорт и `GreenApiError` → `src/api/greenApiClient.ts`
- [x] `getStateInstance` → `src/services/instanceService.ts`
- [x] `apiUrl` из `idInstance` → `src/helpers/apiUrl.ts`
- [x] валидация и нормализация полей → `src/helpers/credentialsValidation.ts`
- [x] тексты ошибок входа → `src/helpers/signInError.ts`
- [x] стор сессии → `src/stores/sessionStore.ts`
- [x] хук входа → `src/hooks/useSignIn.ts`
- [x] тесты: `src/api/__tests__/`, `src/helpers/__tests__/`, `src/stores/__tests__/`, `src/hooks/__tests__/`

## Ф1: UI

- [x] токены → `src/styles/tokens/`
- [x] кит → `src/components/ui/Button/`, `src/components/ui/Input/`
- [x] форма входа → `src/pages/LoginPage/`
- [x] оболочка чата с «Выйти» → `src/pages/ChatPage/`
- [x] выбор экрана → `src/App.tsx`
- [x] тесты → `src/test/renderWithQueryClient.tsx`, `LoginPage.test.tsx`, `App.test.tsx`
- [x] headless-скриншот формы и ошибки 401

## Тесты

- [x] Точечно: `npx vitest run <файл>`, `npx tsc -p tsconfig.app.json --noEmit`
- [x] Полный прогон — **только в `/finish`** (`rules.md` §6) — зелёный, 2026-09-29

## Верификация

- [x] К1–К8 (данные) → тесты: 7 файлов, 30 тестов, 2026-09-29
- [x] К9–К13 (UI) → тесты (8 файлов, 36 тестов) + скриншоты, 2026-09-29
- [ ] К14 → Дима на живом инстансе (чек-лист ресёрча §6, строки 1–5)
- [x] Статус `spec.md`: В РАБОТЕ → ЗАВЕРШЕНО

---

**Статусы**: ` ` не начато | `x` выполнено
