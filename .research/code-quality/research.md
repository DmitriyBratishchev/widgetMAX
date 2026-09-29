# Качество кода: линтер, настройки, ревью

**Статус:** ready-for-task
**Уровень:** эпик
**Дата начала:** 2026-09-29

## 1. Контекст

Эпик `max-chat` (WM-01…WM-04) в `dev` и `main`, сценарий приёмки работает. Проект — тестовое
задание: код будет читать человек-ревьюер. Поводом стал `FormEvent`: в `@types/react` 19.3 он
помечен устаревшим, редактор его зачёркивал, а `tsc` и oxlint промолчали (заменён на `SubmitEvent`
в WM-04). Отсюда два вопроса:

1. Какие настройки инструментов (oxlint, TypeScript, Prettier, CI) рекомендуются и распространены,
   чтобы подобное ловилось автоматически, а не глазами?
2. Что заметит ревьюер-человек из того, что инструменты не ловят?

Ресёрч фиксирует замеры и находки; скоуп исправлений решает Дима (ТЗ: «минимальный набор функций»
— это про функции, не про качество кода).

## 2. Заметки: инструменты

Все замеры — 2026-09-29, ветка `dev` после WM-04 (`1582ea4`), экспериментальные конфиги лежали вне
репозитория, проектные файлы не менялись.

### 2.1. Текущее состояние

| Инструмент | Сейчас | Замечание |
|---|---|---|
| oxlint 1.86 | `plugins: [react, typescript, oxc]` + 3 правила хуков React, `--deny-warnings` | явный `plugins` **заменяет** набор по умолчанию → `unicorn` выключен; категории — только `correctness` (по умолчанию) |
| TypeScript 6.0.3 | в `tsconfig.app.json` нет строки `strict` | `strict` **действует** — умолчание TS 6.0 (проверено `ts.getStrictOptionValue`: strict, noImplicitAny, strictNullChecks — `true`). Ревьюер с опытом TS 5 решит, что выключен |
| Prettier | `singleQuote`, `printWidth: 100`, `trailingComma: all`, LF через `.gitattributes` | стандартно; `.editorconfig` нет |
| CI | `.github/workflows/deploy.yml`: push в `main` → `test:run` → `build` → Pages | lint и `format:check` не гоняются, PR `dev → main` не проверяется до слияния |
| SCSS | правило «литералы только в `tokens/`» | проверяет только хук Claude (`check-hardcoded-colors.js`, только цвета, только правки Claude); у человека и в CI проверки нет |
| `package.json` | `version: 0.0.0`, нет `description`/`repository`, нет скрипта `typecheck` | бросается в глаза |

### 2.2. oxlint: категории и плагины (замер)

Конфиг с плагинами `eslint, typescript, unicorn, react, react-perf, oxc, import, jsx-a11y, vitest,
promise`, по одной категории (`warn`), без `dist/`, `.claude/`. Число — всего находок (включая 20
от `correctness`, она включена всегда).

| Категория | Находок | Что внутри |
|---|---|---|
| correctness | 20 | все 20 — `vitest/require-mock-type-parameters` (`vi.fn()` без параметра типа) |
| suspicious | 124 | 95 `react/react-in-jsx-scope` — **ложные** (новый JSX-трансформ, правило выключают); `unicorn/consistent-function-scoping` 5 (хелперы в тестах); `import/no-unassigned-import` 2 (импорт стилей и jest-dom — ложные, нужен allow-список); `unicorn/no-array-sort` 1; `react/exhaustive-effect-dependencies` 1 (`MessageList.tsx:22` — `messages` как триггер прокрутки, осознанно) |
| perf | 32 | `eslint/no-await-in-loop` 5 — цикл опроса последовательный **намеренно**; `react-perf/jsx-no-new-function-as-prop` 7 — шум без `memo` |
| pedantic | 57 | `require-unicode-regexp` 46 (флаг `u`), `max-lines-per-function` 14 (компоненты и `describe`), `vitest/no-conditional-in-test` 4 (`?? '{}'`), мелочи `unicorn` |
| style | 1130 | сборник взаимоисключающих правил (`no-named-export` и `prefer-default-export`, `no-ternary`, `sort-keys`, `id-length`…) — целиком не включают, только поштучно |
| restriction | 347 | в основном запреты языка (`no-async-await`, `no-optional-chaining`) — шум; полезны точечно `typescript/no-non-null-assertion` (2), `eslint/no-empty-function` (5) |

`jsx-a11y` — **0 находок** во всех категориях. `import/order` в oxlint нет (есть `sort-imports`,
`import/first`, `import/no-duplicates`, `import/consistent-type-specifier-style`).

### 2.3. Устаревшие API: type-aware `typescript/no-deprecated`

- Нужен пакет `oxlint-tsgolint` (npm 7.0.2003) и `typeAware: true` в конфиге (или `--type-aware`).
- Проверено: установка `npm install --no-save oxlint-tsgolint` (package.json и lock не менялись),
  прогон только `typescript/no-deprecated` → **0** по проекту; временный файл
  `import type { FormEvent } from 'react'` → `FormEvent is deprecated` [Error] — ловит. Файл удалён.
- Независимая проверка тем же вопросом через TypeScript Language Service (подсказки 6385/6387, как
  зачёркивание в редакторе) — 0 по 52 файлам `tsconfig.app.json` и `vite.config.ts` (WM-04).

Другие type-aware правила `typescript-eslint` (замер тем же способом):

| Правило | Находок | Оценка |
|---|---|---|
| `no-floating-promises`, `no-misused-promises`, `await-thenable`, `only-throw-error`, `no-unnecessary-type-assertion` | 0 | включить бесплатно — страхуют на будущее |
| `switch-exhaustiveness-check` | 5 | `chatError.ts`, `signInError.ts` — полезно разобрать |
| `no-unsafe-member-access` / `no-unsafe-return` | 5 / 1 | `JSON.parse(...).state` в тестах сторов — типизировать хелпер |
| `no-unnecessary-condition` | 3 | `useNotificationPolling.ts:48,53,60` — **ложные**: TS не знает, что `signal.aborted` меняется во время `await` |
| `strict-boolean-expressions` | 7 | стиль, спорно |
| `no-confusing-void-expression` | 45 | конфликтует с идиомой Zustand `(x) => set(...)` — не включать |

### 2.4. TypeScript: флаги сверх `strict`

`npx tsc -p tsconfig.app.json --noEmit --<флаг>`:

| Флаг | Ошибок | Оценка |
|---|---|---|
| `noImplicitReturns`, `noImplicitOverride`, `noUncheckedSideEffectImports` | 0 | включить бесплатно |
| `noUncheckedIndexedAccess` | 7 | 1 в коде (`useNotificationPolling.ts:63`, индекс в `RETRY_DELAYS_MS`), 6 в тестах — распространённая рекомендация, недорого |
| `exactOptionalPropertyTypes` | 9 | трение с пропсами React и опциями транспорта — не включать |
| `noPropertyAccessFromIndexSignature` | 46 | конфликт с CSS-модулями (`styles.button`) — не включать |

Плюс явная строка `"strict": true` — для читателя, поведение не меняется.

### 2.5. Прочее из «распространённых настроек»

- **CI на PR**: отдельный workflow на `pull_request` + push в `dev` — `lint`, `format:check`,
  `typecheck`, `test:run`, `build`. Сейчас PR `dev → main` проверяется только после слияния.
- **`.editorconfig`** — отступы/LF/финальная строка для редакторов без Prettier.
- **Stylelint** (`stylelint-config-standard-scss` + запрет литералов цвета/размера вне `tokens/`,
  `@media` вне `mixins/`) — перевёл бы золотое правило 4 из хука Claude в инструмент проекта.
  Новая зависимость и конфиг; замер не делался.
- **`package.json`**: `version`, `description`, `repository`, скрипт `typecheck` (`tsc -b`).
- **Vitest**: `restoreMocks`/`mockReset` в конфиге вместо ручного `mockReset()` в каждом `beforeEach`.
- **Порядок импортов** — сейчас вручную; `sort-imports` oxlint сортирует только члены внутри `{}`,
  групп (`react` → `@/…` → `./…`) не знает. Варианты: оставить как есть или Prettier-плагин
  сортировки импортов (новая зависимость).
- `index.html`: нет favicon (404 в консоли на демо) и `meta description`.

## 3. Заметки: ревью глазами человека

Ревью всего `src/` и конфигов (агент, только чтение, 2026-09-29; сверено с `rules.md` и
`frontend-patterns`, чтобы не предлагать противоречащее решениям). Помечено **[проверено]** — место
перечитано вручную. Остальное — со слов ревью, перед правкой перепроверить.

### 3.1. Надёжность

- **[проверено]** Гонка при выходе: `onSuccess` в опциях `useMutation` (`useCreateChat.ts:24`,
  `useSendMessage.ts:23`) срабатывает и после размонтирования. «Создать чат» → сразу «Выйти» →
  ответ `CheckAccount` пишет чат в уже сброшенный стор → он переживает выход в `sessionStorage`.
- **[проверено]** Цикл опроса `catch {}` (`useNotificationPolling.ts:59`) не различает ошибки: 401
  (токен отозван) — бесконечные повторы с паузой до 30 с, в UI ничего; `TypeError` в коде — тоже
  молча. Связано с решением WM-03 «ошибки опроса в UI не показываем» — пересмотреть?
- **[проверено]** Транспорт `greenApiClient.ts:71`: `(text ? JSON.parse(text) : null) as T` — тип
  врёт на пустом 200, битый JSON даёт сырой `SyntaxError`, не `GreenApiError`. Таймаута у `fetch`
  нет — зависшая сеть держит `isPending` бесконечно.
- **[проверено]** `notification.ts:35`: `DIRECTION_BY_WEBHOOK[typeWebhook]` ищет и по прототипу
  (`typeWebhook: 'toString'` → функция как направление). Лечится `Object.hasOwn` / `switch`.
- `MessageComposer`: поле не заблокировано во время отправки, `onSuccess: () => setText('')`
  стирает допечатанное за это время.

### 3.2. Доступность

- **[проверено]** `--color-focus-ring: blue-100` (#e3ecff) на белом — контраст ≈1,2:1 (норма 3:1);
  на активном чате (`--color-chat-item-active` тоже blue-100) кольцо не видно совсем.
- **[проверено]** `--color-text-muted` (#9aa1ad) на белом ≈2,6:1 — ниже WCAG AA для 12–13px (время,
  пустые состояния).
- Лента не объявляется скринридеру (`aria-live="polite"` / `role="log"`), направление сообщения —
  только цветом и выравниванием.
- Фокус: после «Назад» падает на `body`, после открытия чата не переходит в поле ввода; при ошибках
  входа не уходит на первое невалидное поле.

### 3.3. Код и стиль

- **[проверено]** Комментарии ссылаются на внутренний процесс: «skill green-api §3», «ресёрч max-chat
  §3 Р1», «WM-03 получит эхо…» (будущее время, задача слита) — 17 мест в `src/`. Внешнему читателю не
  говорят ничего и выдают процесс; суть стоит писать в самом комментарии.
- Дубли: тексты ошибок 429/сеть в `signInError.ts` и `chatError.ts`; лимит 4000 и «11–12 цифр» —
  литералами в текстах; `new Date(ts).toISOString()` дважды; `.error`, `.icon`, `.empty`/`.placeholder`,
  `focus-visible outline` повторены в SCSS; `transition 0.15s` — литерал вне токенов.
- Три способа склейки `className` (шаблон, `filter(Boolean).join`, массив) → один `cx()`.
- «Назад» — сырой `<button>`, отправка — `Button` кита с хаком специфичности `.row .send` → `IconButton`.
- `Button`/`Input` на `*HTMLAttributes` без `ref` → `ComponentProps<'button'>`; `className` у `Input`
  уходит на обёртку.
- Экспортированные, но неиспользуемые константы опроса; тесты хардкодят те же `20` и `1_000`.
- `LoginPage` не сбрасывает ошибку входа при правке поля (в отличие от `NewChatForm`/`MessageComposer`).
- `main.tsx`: `getElementById('root')!`.

### 3.4. Тесты

- **[проверено]** Фейковые учётные данные скопированы в 12 файлов → `src/test/fixtures.ts` (skill
  `frontend-patterns` это прямо предусматривает).
- Обёртка `QueryClient` для `renderHook` продублирована в 3 тестах хуков → `renderHookWithQueryClient`.
- `flush()` из 20 `await Promise.resolve()` (`useNotificationPolling.test.tsx`) хрупок →
  `vi.waitFor`.
- Не покрыто: IME-ветка Enter, пустой номер, 401 в цикле опроса, выход во время мутации.

## 4. Варианты

**A. Только инструменты** — конфиг oxlint (плагины, категории, type-aware), флаги TS, CI на PR,
`package.json`, `.editorconfig`; правки ровно те, что потребуют инструменты. Малый объём, закрывает
«устаревшее ловится само».

**B. A + надёжность и доступность** — §3.1 и §3.2: гонка выхода, транспорт, 401 в опросе (с решением
по UI), контраст и фокус. То, что ревьюер отметит как дефекты.

**C. B + чистка** — §3.3 и §3.4: комментарии без ссылок на процесс, дубли, `cx`, `IconButton`,
фикстуры тестов. Косметика, но именно её человек видит первой при чтении кода.

Рекомендация: **C, нарезанная на задачи** (порядок = приоритет): сначала инструменты — они же
подсветят часть §3; затем надёжность; затем доступность; затем чистка. Каждая — своя ветка и коммит,
ревьюер видит границы.

## 5. Открытые вопросы

- [x] Объём → **C**, четыре задачи (Дима, 2026-09-29).
- [x] 401 в цикле опроса → **остановить цикл и показать** (Дима) — пересмотр решения WM-03.
- [x] Комментарии со ссылками на skill/ресёрч/WM-NN → **оставить** (Дима): ссылки ведут на документы
      в репозитории. Правятся только комментарии, **неверные по смыслу** (например, будущее время
      «WM-03 получит эхо» у слитой задачи).
- [x] Stylelint → **не брать** (Дима): правило токенов остаётся за хуком Claude и ревью.
- [x] Сортировка импортов → **вручную, как сейчас** (по умолчанию: без новой зависимости; группы
      `react`/пакеты → `@/…` → `./…` уже соблюдаются).

## 6. Выводы

Решения Димы (2026-09-29, AskUserQuestion):

| # | Решение | Причина |
|---|---|---|
| Р1 | Объём **C**: инструменты → надёжность → доступность → чистка, каждая — своя задача | ревьюер видит и дефекты, и косметику; границы задач видны в истории |
| Р2 | 401/403 в цикле опроса → цикл **останавливается**, над лентой плашка «Приём сообщений остановлен: GREEN-API не принял учётные данные. Войдите заново». Сеть/429/5xx — как раньше, молча с паузами | молчаливые бесконечные повторы на отозванном токене — дефект; сеть восстанавливается сама, 401 — нет |
| Р3 | Комментарии со ссылками на skill/ресёрч/WM-NN **остаются** | ссылки ведут на документы в репозитории |
| Р4 | **Без Stylelint** | лишняя зависимость; правило токенов держат хук и ревью |
| Р5 | Импорты сортируются вручную | без новой зависимости |

Рекомендуемый конфиг инструментов (детали — в спеке WM-05): oxlint — плагины `eslint, typescript,
unicorn, react, oxc, import, jsx-a11y, vitest`; `correctness` — error, `suspicious` — warn с
выключенными ложными (`react-in-jsx-scope`, `no-unassigned-import` для стилей/`setup.ts`); из
`pedantic` — точечно; `typeAware` с `no-deprecated`, `no-floating-promises`, `no-misused-promises`,
`await-thenable`, `only-throw-error`, `no-unnecessary-type-assertion`, `switch-exhaustiveness-check`;
`no-await-in-loop` / `exhaustive-effect-dependencies` — отключить в месте с причиной. TS — явный
`strict` + `noUncheckedIndexedAccess`, `noImplicitReturns`, `noImplicitOverride`. CI — workflow на
PR и push в `dev`.

## 7. Разбивка на задачи

| WM-NN | Задача | Зависит от | § ресёрча | Источник | Статус |
|---|---|---|---|---|---|
| WM-05 | Инструменты качества: oxlint (плагины, категории, type-aware `no-deprecated`), флаги TS, CI на PR, `package.json` (`typecheck`, версия, описание), `.editorconfig`, Vitest `restoreMocks`; исправить всё, что инструменты подсветят | — | §2, §6 | план | в dev WM-05@2026-09-29 |
| WM-06 | Надёжность: гонка выхода в мутациях, 401 в опросе (Р2), транспорт (пустое тело, битый JSON, таймаут), `Object.hasOwn` в разборе уведомлений, текст в поле во время отправки; тесты на гонку и 401 | WM-05 | §3.1, §6 Р2 | план | план |
| WM-07 | Доступность: контраст кольца фокуса и muted-текста (токены), live-регион ленты и направление сообщения для скринридера, фокус после «Назад» / открытия чата / ошибки входа | WM-05 | §3.2 | план | план |
| WM-08 | Чистка кода и тестов: дубли текстов и SCSS, `cx()`, `IconButton`, `ComponentProps` в ките, константы вместо литералов, фикстуры и `renderHookWithQueryClient`, `vi.waitFor` вместо `flush()`, неверные по смыслу комментарии, `favicon`/`meta description` | WM-06, WM-07 | §3.3, §3.4, §2.5 | план | план |

Каждая задача — одной фазой (`.claude/CLAUDE.md` §«Зафиксированные договорённости»). WM-08 последней:
она трогает те же файлы, что WM-06/WM-07, и после них дублей меньше.

## 8. Чек-лист сквозных сценариев

Правило накопления: **любая** задача эпика, добавляя или меняя поведение, дописывает сюда строки.
Регресс основного сценария — чек-лист `.research/max-chat/research.md` §6 (строки 1–13a) после
каждой задачи, трогающей `src/`.

| # | Где | Действие | Ожидание | Приоритет |
|---|---|---|---|---|
| 1 | Репозиторий | `npm run lint` с временным `import type { FormEvent } from 'react'` | ошибка `typescript/no-deprecated`, lint падает | 🔴 |
| 2 | GitHub | открыть PR в `main` / push в `dev` | workflow проверок: lint, format, typecheck, тесты, сборка — зелёные | 🔴 |
| 3 | Лента | войти, отозвать токен в кабинете GREEN-API (или сменить инстанс) | цикл остановился, плашка «Приём сообщений остановлен…», запросы `receiveNotification` не сыплются | 🔴 |
| 4 | Чаты | «Создать чат» и сразу «Выйти», войти снова | список пуст, чат прошлой сессии не появился | ⚠️ |
| 5 | Лента | допечатать текст, пока идёт отправка | допечатанное не стёрто | ⚠️ |
| 6 | Все экраны | пройти интерфейс клавишей Tab | кольцо фокуса видно везде, включая активный чат | 🔴 |
| 7 | Лента | ответ собеседника при включённом скринридере | новое сообщение объявлено | ⚠️ |
| 8 | Узкий экран | открыть чат → «Назад» | фокус в поле ввода, после «Назад» — на чате в списке | ⚠️ |
| 9 | Все | основной сценарий 1–5 (`max-chat` §6) | работает как до эпика | 🔴 |

## 9. Известные проблемы

- ~~`oxlint-tsgolint` стоит в `node_modules` после эксперимента (`--no-save`)~~ — решено в WM-05:
  прямая devDependency, в lock есть бинарник `@oxlint-tsgolint/linux-x64` для CI.
- `flush()` в `useNotificationPolling.test.tsx` — цикл `await Promise.resolve()`; в WM-05 на нём
  отключён `no-await-in-loop` с причиной. Замена на `vi.waitFor` (WM-08) снимет и отключение.
