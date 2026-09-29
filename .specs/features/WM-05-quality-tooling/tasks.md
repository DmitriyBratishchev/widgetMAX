# Tasks: Инструменты качества: линтер, типы, CI

**Задача**: WM-05
**Спек**: `.specs/features/WM-05-quality-tooling/spec.md`
**План**: `.specs/features/WM-05-quality-tooling/plan.md`

> **Живой документ** — статусы и шаги обновляются по мере выполнения.

---

## Ф1: инструменты качества

- [x] ветка + перенос спеки → `.specs/features/WM-05-quality-tooling/`
- [x] `oxlint-tsgolint` + поля и скрипт `typecheck` → `package.json`, `package-lock.json`
- [x] конфиг oxlint → `.oxlintrc.json`
- [x] типы моков `vi.fn<T>()` → тесты `src/**/__tests__/*`
- [x] `switch` с `default` → `src/helpers/chatError.ts`, `src/helpers/signInError.ts`
- [x] `readPersistedState` → `src/test/persistedState.ts` + тесты сторов и `App`
- [x] прочие находки (scoping, `toSorted`, `async`, `as Error`) → тесты
- [x] отключения в месте ×5 → `useNotificationPolling.ts`, `MessageList.tsx`, `greenApiClient.ts`, `signInError.test.ts`, `useNotificationPolling.test.tsx` (`flush()`)
- [x] флаги TS → `tsconfig.app.json`, `tsconfig.node.json`; пауза → `useNotificationPolling.ts`; тесты
- [x] `mockReset: true` → `vite.config.ts`; ручные `.mockReset()` из тестов
- [x] `.editorconfig`, `.github/workflows/ci.yml`
- [x] документы: `.claude/CLAUDE.md`, `.claude/rules.md` §6, skill `frontend-patterns`, README, ресёрч §7/§9

## Тесты

- [x] Точечно: `npm run lint`, `npm run typecheck`, `npx vitest run <файл>`
- [x] Полный прогон — **только в `/finish`**: `npm run lint` + `npm run format:check` +
      `npm run build` + `npm run test:run -- --maxWorkers=2`

## Верификация

- [x] К1–К11 → доказательства (`spec.md` §«Доказательства»)
- [ ] К12 — Диме: после пуша `dev` workflow CI зелёный в Actions
- [x] Статус `spec.md`: В РАБОТЕ → ЗАВЕРШЕНО

---

**Статусы**: ` ` не начато | `x` выполнено
**Правило**: обновлять статусы по мере выполнения
