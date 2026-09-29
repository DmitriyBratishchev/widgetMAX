# Инструменты качества: линтер, типы, CI

**Статус**: ЗАВЕРШЕНО
**Задача**: WM-05
**Дата**: 2026-09-29
**Масштаб**: среднее
**Ресёрч**: `.research/code-quality/research.md` §2, §6, §7

> **Живой документ** — дополняется по ходу выполнения (критерии/скоуп/статус). Если фаза
> выявила изменение задачи или эпика — правку внести здесь и/или в ресёрч (`rules.md` §3).

---

## Проблема

`FormEvent` в `@types/react` 19.3 помечен устаревшим: редактор его зачёркивал, а `tsc` и oxlint
промолчали (заменён на `SubmitEvent` в WM-04). Причины (ресёрч §2.1): явный
`plugins: [react, typescript, oxc]` в `.oxlintrc.json` **заменяет** набор по умолчанию, категории —
только `correctness`, type-aware правил нет; CI гоняет только тесты и сборку по push в `main`, PR
`dev → main` до слияния не проверяется. Устаревшие API и типовые ошибки должны ловить инструменты,
а не глаза.

## Решение

Рекомендуемый конфиг — ресёрч §6; замеры — §2.2–§2.4. Здесь — решения задачи и их причины.

### Замер на старте (2026-09-29)

Предлагаемый конфиг до правок: 20 `vitest/require-mock-type-parameters`, 5
`switch-exhaustiveness-check`, 5 `unicorn/consistent-function-scoping` (тесты), 5
`no-unsafe-member-access` + 1 `no-unsafe-return` (`JSON.parse(...).state` в тестах), 4
`vitest/no-conditional-in-test` (те же `?? '{}'`), 4 `typescript/no-unsafe-type-assertion`, 5
`eslint/no-await-in-loop` (один цикл опроса), 2 `import/no-unassigned-import`, 1
`typescript/require-await`, 1 `unicorn/no-array-sort`, 1 `react/exhaustive-effect-dependencies`,
1 `typescript/consistent-return`. TS с новыми флагами — 7 ошибок (1 в коде, 6 в тестах),
`tsconfig.node.json` — 0.

### oxlint (`.oxlintrc.json`)

- `plugins`: `eslint, typescript, unicorn, react, oxc, import, jsx-a11y, vitest`.
- `categories`: `correctness: error`, `suspicious: warn` — скрипт `lint` идёт с
  `--deny-warnings`, так что предупреждение тоже роняет прогон.
- `options`: `typeAware: true` (пакет `oxlint-tsgolint` в devDependencies),
  `reportUnusedDisableDirectives: "error"` — отключение в месте, ставшее лишним, роняет lint, а не
  гниёт.
- Правила хуков React — как были.
- Type-aware — `error`: `no-deprecated`, `no-floating-promises`, `no-misused-promises`,
  `await-thenable`, `only-throw-error`, `no-unnecessary-type-assertion`,
  `switch-exhaustiveness-check` с `considerDefaultExhaustiveForUnions: true` (без опции ветка
  `default` не считается закрытием союза — `describeInstanceState` пришлось бы перечислять
  `authorized`, которое туда не попадает).
- Из pedantic — точечно: `typescript/no-unsafe-{member-access,return,assignment,call,argument}`
  (`any` не расползается; 6 находок, все в тестах), `typescript/require-await` (1),
  `vitest/no-conditional-in-test` (4, уходят вместе с хелпером `readPersistedState`). Из perf —
  только `eslint/no-await-in-loop`: ловит случайно последовательный код, намеренный цикл опроса
  отключён в месте.
- **Не включаем**: `require-unicode-regexp` (13; шаблоны ASCII — флаг `u` поведения не меняет),
  `max-lines*` и `import/max-dependencies` (размер — вкусовщина), `prefer-readonly-parameter-types`
  (95), `strict-boolean-expressions` (7, стиль), `strict-void-return` и
  `no-confusing-void-expression` (спорят с идиомой Zustand `(x) => set(...)`),
  `no-unnecessary-condition` (ложные на `signal.aborted` после `await`), единичные стилевые
  `unicorn/*` из pedantic, категории `style` и `restriction` (ресёрч §2.2).
- **Выключаем / настраиваем**: `react/react-in-jsx-scope: off` (новый JSX-трансформ, 95 ложных);
  `typescript/consistent-return: off` (спорит с идиомой `useEffect` «`return;` без подписки /
  `return cleanup`», полезную часть закрывает `noImplicitReturns`); `import/no-unassigned-import`
  с `allow: ["**/*.scss", "@testing-library/jest-dom/vitest"]` (импорт стилей и регистрация
  матчеров — по замыслу без привязки).
- **Отключения в месте, с причиной** (`// eslint-disable… -- причина`):
  - `eslint/no-await-in-loop` — цикл в `src/hooks/useNotificationPolling.ts`: receive → delete →
    receive строго последовательно (skill `green-api` §3);
  - `react/exhaustive-effect-dependencies` — `src/pages/ChatPage/MessageList/MessageList.tsx`:
    `messages` — триггер прокрутки, а не читаемое значение;
  - `typescript/no-unsafe-type-assertion` — `src/api/greenApiClient.ts` (`as T`): ответ GREEN-API в
    рантайме не валидируется, тип — контракт вызывающего;
  - `typescript/no-unsafe-type-assertion` — `src/helpers/__tests__/signInError.test.ts`: тест
    намеренно подсовывает состояние вне типа;
  - `eslint/no-await-in-loop` — `flush()` в `src/hooks/__tests__/useNotificationPolling.test.tsx`:
    каждый `await` — отдельный микротакт (всплыло при реализации, 2026-09-29: замер ресёрча
    считал его среди 5 находок «цикла опроса»). Замена `flush()` на `vi.waitFor` — WM-08, снимет и
    отключение (ресёрч §9).
- Попутно: `expect.not.stringContaining(…)` возвращает `any` и роняет `no-unsafe-assignment` —
  проверка «токена нет в тексте ошибки» в `greenApiClient.test.ts` — `String(error)` вместо
  `(error as Error).message`.

### TypeScript (`tsconfig.app.json`, `tsconfig.node.json`)

Явный `"strict": true` (умолчание TS 6 — строка для читателя с опытом TS 5),
`noUncheckedIndexedAccess`, `noImplicitReturns`, `noImplicitOverride`. **Не включаем**
`exactOptionalPropertyTypes` (9, трение с пропсами React) и `noPropertyAccessFromIndexSignature`
(46, CSS-модули) — ресёрч §2.4.

Единственная правка кода от флагов — пауза после ошибки в `useNotificationPolling.ts`: таблица
`RETRY_DELAYS_MS` без последнего значения + `MAX_RETRY_DELAY_MS`, пауза
`RETRY_DELAYS_MS[failures - 1] ?? MAX_RETRY_DELAY_MS`. Последовательность та же (1/2/4/8/16/30 с),
без `Math.min` и без `!`. В тестах индекс сужается `assert.isDefined` из `vitest`.

### Vitest

`mockReset: true` в `vite.config.ts` вместо ручного `.mockReset()` в `beforeEach`. Семантика
Vitest 5 проверена по `@vitest/spy`: `mockReset` у `vi.fn(impl)` возвращает `impl`, у `vi.fn()` —
пустую функцию, так что фабрики `vi.mock` с реализацией (`App.test.tsx`) не ломаются.
**`restoreMocks` не берём**: с Vitest 3 он восстанавливает только `vi.spyOn`, а `spyOn` в проекте
нет — строка без эффекта. `clearMocks` в Vitest 5 и так `true`.

### Прочее

- `.github/workflows/ci.yml`: `pull_request` + push в `dev`; `permissions: contents: read`;
  `concurrency` по ref с отменой устаревшего прогона; `npm ci → lint → format:check → typecheck →
  test:run → build`; версии actions и Node — как в `deploy.yml`. Секретов нет. `deploy.yml` не
  меняется: `main` получает код через PR, который уже проверил CI.
- `package.json`: `version: 1.0.0`, `description`, `repository`, скрипт `typecheck` (`tsc -b` —
  оба проекта TS, как в `build`).
- `.editorconfig`: UTF-8, LF, два пробела, финальная строка, обрезка пробелов (кроме `*.md`).
  Согласован с `.prettierrc.json` (Prettier читает `.editorconfig`, но `.prettierrc.json`
  главнее) и `.gitattributes` (LF).

## Сценарии использования

1. Разработчик импортирует устаревший тип → `npm run lint` падает с `typescript(no-deprecated)`.
2. PR в `main` или push в `dev` → GitHub Actions гоняет lint, формат, типы, тесты, сборку.

## Критерии приёмки

- [x] **К1.** `npm run lint` зелёный с новым конфигом (0 warnings, 0 errors) — вывод команды.
- [x] **К2.** Временный `src/deprecatedProbe.ts` с `import type { FormEvent } from 'react'` →
  `npm run lint` падает с `typescript(no-deprecated)`; файл удалён — вывод + `git status`.
- [x] **К3.** Конфиг oxlint соответствует §«Решение» (плагины, категории, type-aware, выключенные с
  причиной); `oxlint-tsgolint` — прямая devDependency, в lock есть `@oxlint-tsgolint/linux-x64` —
  ревью + `npm ls oxlint-tsgolint` + `grep` по lock.
- [x] **К4.** Отключения в месте — ровно 5 мест из §«Решение», у каждого причина —
  `grep -rn "eslint-disable" src`; лишнее отключение ловит `reportUnusedDisableDirectives`.
- [x] **К5.** `npm run typecheck` и `npm run build` зелёные с новыми флагами TS — вывод.
- [x] **К6.** `ci.yml` прошёл ревью (триггеры, права read, порядок шагов, без секретов);
  `git diff dev -- .github/workflows/deploy.yml` пуст.
- [x] **К7.** `package.json`: `version`, `description`, `repository`, `typecheck` — ревью.
- [x] **К8.** `.editorconfig` согласован с Prettier и `.gitattributes`; `npm run format:check`
  зелёный — ревью + вывод.
- [x] **К9.** `mockReset: true` в конфиге, ручных `.mockReset()` в `src/` нет —
  `grep -rn "mockReset" src` пуст + К10.
- [x] **К10.** Тесты зелёные — `npm run test:run -- --maxWorkers=2` (память машины, `plan.md`
  §«Грабли»).
- [x] **К11.** Документы обновлены: `.claude/CLAUDE.md`, `.claude/rules.md` §6, skill
  `frontend-patterns` §TypeScript/§Тестирование, README, ресёрч §7/§9 — ревью диффа.
- [ ] **К12.** (не проверено — ждёт Диму) После пуша `dev` workflow CI зелёный на вкладке Actions (ресёрч §8
  строка 2).

### Доказательства (2026-09-29)

- К1: `npm run lint` → пустой вывод, код 0.
- К2: `src/deprecatedProbe.ts` → `error typescript(no-deprecated): FormEvent is deprecated`, код 1;
  файл удалён, в `git status` его нет.
- К3: `npm ls oxlint-tsgolint` → прямая `oxlint-tsgolint@7.0.2003`; в lock
  `node_modules/@oxlint-tsgolint/linux-x64` — 1 запись.
- К4: `grep -rn "eslint-disable" src` → 5 директив (блок цикла опроса — пара disable/enable), у
  каждой причина.
- К5: `npm run typecheck` код 0; `npm run build` → built, код 0.
- К6: ревью `ci.yml`; `git diff --cached --quiet -- .github/workflows/deploy.yml` → без изменений.
- К8: `npm run format:check` → «All matched files use Prettier code style!».
- К9: `grep -rn mockReset src` → 0 строк.
- К10: `npm run test:run -- --maxWorkers=2` → 19 файлов, 139 тестов, все зелёные.

## Затрагиваемые файлы

- `.oxlintrc.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`
- `package.json`, `package-lock.json`, `.editorconfig`, `.github/workflows/ci.yml`
- `src/helpers/chatError.ts`, `src/helpers/signInError.ts`, `src/hooks/useNotificationPolling.ts`,
  `src/pages/ChatPage/MessageList/MessageList.tsx`, `src/api/greenApiClient.ts` (комментарий)
- `src/test/persistedState.ts` (новый), тесты `src/**/__tests__/*`
- `README.md`, `.claude/CLAUDE.md`, `.claude/rules.md`, `.claude/skills/frontend-patterns/SKILL.md`,
  `.research/code-quality/research.md`

## Что НЕ входит в скоуп

- Правки поведения — WM-06 (в том числе транспорт `greenApiClient.ts`: пустое тело, битый JSON)
- Контраст и фокус — WM-07; дубли и рефакторинг — WM-08
- Stylelint (ресёрч §6 Р4), сортировка импортов инструментом (Р5)

## Уровень риска

CAUTION — конфиг сборки и CI. Ресёрч сделан (§2), `deploy.yml` не меняется, поведение приложения
не меняется (пауза опроса — та же последовательность).
