# Plan: Инструменты качества: линтер, типы, CI

**Задача**: WM-05
**Ветка**: `feature/WM-05-quality-tooling`
**Уровень риска**: CAUTION
**Спек**: `.specs/features/WM-05-quality-tooling/spec.md`
**Ресёрч**: `.research/code-quality/research.md` §2, §6, §7

> **Живой документ** — шаги/фазы дописываются **накопительно** (отмечать сделанное, не
> переписывать историю плана).

---

## Карта фаз

| Фаза | Цель | Трогает GREEN-API | Критерии | Статус |
|------|------|-------------------|----------|--------|
| **Ф1** | oxlint + type-aware, флаги TS, Vitest `mockReset`, CI, `package.json`, `.editorconfig`, находки инструментов, документы | нет | К1–К12 | **VERIFIED** (2026-09-29), К12 ждёт Диму |

---

## Ф1 — инструменты качества

### Шаги

1. Ветка, перенос спеки в `.specs/features/WM-05-quality-tooling/`.
2. `npm install -D oxlint-tsgolint`; `package.json` — version, description, repository,
   `typecheck`; в lock есть `@oxlint-tsgolint/linux-x64` (нужен CI).
3. `.oxlintrc.json` — по spec §«Решение».
4. Находки инструментов:
   - `vi.fn()` → `vi.fn<typeof fn>()` в фабриках `vi.mock` (`typeof` импортированной функции —
     только тип, подъём `vi.mock` не мешает); `greenApiClient.test.ts` → `vi.fn<typeof fetch>(…)`;
   - `chatError.ts`, `signInError.ts` — явный `default` в `switch` по `status`;
   - `src/test/persistedState.ts` — `readPersistedState(key): unknown` вместо
     `JSON.parse(...).state` в тестах сторов и `App`;
   - `greenApiClient.test.ts` — `toMatchObject({ message: expect.not.stringContaining(…) })`
     вместо `as Error`;
   - `consistent-function-scoping`: `wrapper`, `liveLoops` — на уровень модуля; заглушки
     `let x: F = () => {}` → `let x!: F`;
   - `toSorted()`, лишний `async`; 4 отключения в месте с причиной.
5. tsconfig — флаги; `useNotificationPolling.ts` — `MAX_RETRY_DELAY_MS`; тесты — `assert.isDefined`,
   `lastReceive()` с `throw`.
6. `vite.config.ts` — `mockReset: true`; ручные `.mockReset()` из тестов.
7. `.editorconfig`, `.github/workflows/ci.yml`.
8. Документы: `.claude/CLAUDE.md`, `rules.md` §6, skill `frontend-patterns`, README, ресёрч §9.
9. К2 временным файлом → `/task-check` по желанию → `/finish`.

### По ходу (2026-09-29)

- Отключений в месте — 5, а не 4: `no-await-in-loop` сработал и на тестовом `flush()` (spec
  §«Решение»); уйдёт с заменой `flush()` на `vi.waitFor` в WM-08 (ресёрч §9).
- `expect.not.stringContaining` — `any` → `no-unsafe-assignment`; проверка токена в тексте ошибки —
  `String(error)`.
- Хук Claude блокирует команды, упоминающие `.claude/settings.json`: разрешение на
  `npm run typecheck` в allow-список не добавлено — при желании Дима добавит сам.

### Проверка Ф1 (DoD)

- **Команда**: `npm run lint` + `npm run format:check` + `npm run typecheck` + `npm run build` +
  `npm run test:run -- --maxWorkers=2`; К2 — временный файл с `FormEvent`.
- **Ожидаемый результат**: всё зелёное; К2 — `typescript(no-deprecated)` и ненулевой код выхода.

### Грабли

- `npm run test:run` без `--maxWorkers=2` локально валит воркеры Vitest («Fatal process out of
  memory: Zone»); в CI ограничение не нужно.
- Порты 5173/5174 заняты чужими процессами — свой сервер только на 5175 с `--strictPort`.
- Git Bash переписывает аргументы `/path` → `MSYS_NO_PATHCONV=1`.

---

## Тесты

- [x] Точечно по ходу: `npm run lint`, `npm run typecheck`, `npx vitest run <файл>`
- [x] Полный прогон — **только в `/finish`** (`rules.md` §6):
      `npm run lint` + `npm run format:check` + `npm run build` + `npm run test:run -- --maxWorkers=2`
