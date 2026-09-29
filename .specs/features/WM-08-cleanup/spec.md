# Чистка кода и тестов

**Статус**: ЗАВЕРШЕНО
**Задача**: WM-08
**Дата**: 2026-09-29
**Масштаб**: среднее
**Ресёрч**: `.research/code-quality/research.md` — §3.3, §3.4, §2.5 (favicon/meta), §7, §9 (`flush()`)

> **Живой документ** — дополняется по ходу выполнения (критерии/скоуп/статус). Если фаза
> выявила изменение задачи или эпика — правку внести здесь и/или в ресёрч (`rules.md` §3).
>
> **Статусы**: ЧЕРНОВИК → УТВЕРЖДЕНО → В РАБОТЕ → ЗАВЕРШЕНО. В `ЗАВЕРШЕНО` переводим
> только на **последней** фазе задачи, когда все критерии `[x]`.

---

## Проблема

Последняя задача эпика: косметика, которую ревьюер видит первой при чтении кода. Поведение не
меняется — кроме сброса ошибки входа при правке поля. Каждое место перепроверено по `dev` после
WM-07 (`68656d1`) — подтвердились все:

- Текст 429 одинаков в `signInError.ts:45` и `chatError.ts:28`. Тексты сети различаются: у входа
  «…и адрес apiUrl».
- Лимит 4000: `MAX_MESSAGE_LENGTH` в `MessageComposer.tsx:15` и литерал в тексте `chatError.ts:61`.
  «11–12 цифр» — литералы в `normalizePhone` (`phone.ts:10`) и в тексте ошибки `NewChatForm.tsx:50`,
  плюс комментарии `phone.ts:4`, `useCreateChat.ts:7`, `types/greenApi.ts:15`.
- `new Date(ts).toISOString()` — `ChatList.tsx:59` и `MessageList.tsx:49`.
- Склейка `className` тремя способами: шаблон (`Avatar`, `MessageList`), `filter(Boolean).join`
  (`Button`, `Input`, `ChatList`).
- «Назад» — сырой `<button>` со своими `.back`/`.icon` в `ChatPage.module.scss`; «Отправить» — `Button`
  кита с хаком специфичности `.row .send` и своим `.icon`.
- `Button`/`Input` на `ButtonHTMLAttributes`/`InputHTMLAttributes` — `ref` не принимают; фокус в
  `LoginPage`/`NewChatForm` (WM-07) — через `form.elements.namedItem`.
- SCSS: кольцо фокуса `outline: var(--focus-ring-width) …` ×5 (`Button`, `Input`, `ChatList`,
  `ChatPage`, `MessageComposer`); текст ошибки `font-size sm + color danger` ×5 (`.error` в
  `LoginPage`, `NewChatForm`, `Input`, `MessageComposer` и `.pollingStopped`); плашка на градиенте
  `.placeholder` (`ChatPage`) = `.empty` (`MessageList`); `transition 0.15s` — литерал вне токенов.
- `useNotificationPolling.ts`: четыре константы экспортированы, а тесты хардкодят те же `20`,
  `1_000`, `2_000`, `30_000`.
- `main.tsx:8` — `getElementById('root')!`.
- `LoginPage` не сбрасывает ошибку входа (`signIn.reset`) при правке поля — в отличие от
  `NewChatForm` и `MessageComposer`.
- Комментарий `chatStore.ts:55` «WM-03 получит эхо…» — будущее время у слитой задачи.
- `index.html`: нет favicon (404 в консоли демо) и `meta description`; каталога `public/` нет.
- Тесты: фейковые `credentials` скопированы в 13 файлов; обёртка `QueryClient` для `renderHook` — в
  трёх тестах хуков; `flush()` — 20× `await Promise.resolve()` с отключённым `no-await-in-loop`;
  нет тестов на Enter во время IME и на пустой номер.

## Решение

1. **429** → `RATE_LIMIT_ERROR_TEXT` в новом `helpers/apiErrorText.ts`: общий для входа и чата, ни
   один из двух модулей ошибок не владелец другого. **Тексты сети — разные осознанно** (Дима,
   AskUserQuestion 2026-09-29): apiUrl вводят только на входе, в чате подсказка про него бессмысленна.
   Причина — комментарием в `signInError.ts`.
2. **Константы — у владельца правила.** `PHONE_MIN_DIGITS = 11`, `PHONE_MAX_DIGITS = 12` — в
   `helpers/phone.ts` (их проверяет `normalizePhone`); текст ошибки `NewChatForm` собирается из них.
   `MAX_MESSAGE_LENGTH` — в новом `helpers/message.ts`: ограничение текста сообщения нужно и
   компоненту (`maxLength`), и `chatError` (текст 400), а брать его из `hooks/` или `services/`
   ни хелпер, ни компонент не должны. Комментарий-контракт в `types/greenApi.ts:15` остаётся — он
   описывает API, а не наш код; в `useCreateChat.ts` — ссылка на `normalizePhone` без цифр.
3. **Дата**: `formatIsoDateTime(timestamp)` в `helpers/formatTime.ts` — значение `dateTime` у `<time>`.
4. **`cx()`** в `helpers/cx.ts`, без новой зависимости. `undefined` в сигнатуре нужен: у CSS-модулей
   под `noUncheckedIndexedAccess` `styles[x]` имеет тип `string | undefined`.
5. **`IconButton`** (`components/ui/IconButton/`): круглая кнопка-иконка. `label` — обязательный проп
   → `aria-label` (у кнопки без текста имя обязательно); `variant: 'primary' | 'ghost'` (отправка /
   «Назад»); `children` — контуры внутри `<svg viewBox="0 0 24 24" aria-hidden>` кита, так что `.icon`
   уходит со страниц; `type` по умолчанию `button`. Видимость «Назад» только на узком экране — через
   обёртку-`span` страницы (`display: none`, на узком — `contents`): класс на самой кнопке снова
   спорил бы специфичностью с базовым классом кита.
6. **Кит на `ComponentProps<'button'>`/`<'input'>`** — React 19 передаёт `ref` обычным пропом, он уходит
   спредом. У `Input` `className` остаётся **на корне поля** (обёртка label + input + ошибка), как у
   составных полей в распространённых китах; `ref` и остальные атрибуты — на `<input>`. Фокус в
   `LoginPage`/`NewChatForm` — через `ref`, `formRef` и `namedItem` уходят. *По ходу:* в `LoginPage` —
   три именованных `useRef`, карта «поле → ref» собирается в обработчике: объект `inputRefs` с
   `ref={inputRefs.idInstance}` правило `react/refs` принимает за чтение ref во время рендера.
7. **SCSS-миксины**: `focus-ring` — в `mixins/_a11y.scss`; `error-text` и `placeholder` (плашка на
   градиенте фона чата) — в новом `mixins/_feedback.scss`. `ChatList .empty` не трогаем — он на белом
   сайдбаре, это не плашка. Длительность перехода — токен `--duration-fast` в `_scale.scss`.
8. **Константы опроса**: экспорт остаётся, тесты используют константы — тест не ломается при смене
   числа и читается как «пауза = `EMPTY_QUEUE_PAUSE_MS`».
9. **`flush()`** → ~~`vi.waitFor` по положительному условию там, где таймеры настоящие~~. *Уточнено
   по ходу:* весь файл `useNotificationPolling.test.tsx` — на фейковых таймерах, шаг цикла —
   `settle()` = `act(() => vi.advanceTimersByTimeAsync(0))`. Причины: (а) половина проверок
   отрицательные («после abort нового receive нет») — `vi.waitFor` ждёт выполнения условия и их не
   выражает; (б) под фейковыми таймерами `vi.waitFor` сам сдвигает время на `interval` (50 мс) и
   ломает точные окна «через 999 мс запроса ещё нет»; (в) `tickAsync` fake-timers начинается с
   настоящей макрозадачи (`originalSetTimeout`, исходник vitest 5.0.2) — к ней цепочка промисов цикла
   проходит целиком, без подсчёта микротактов, а паузы цикла не срабатывают.
10. **Фикстуры**: `TEST_CREDENTIALS` в `src/test/fixtures.ts`; варианты (слэш в apiUrl, пробелы) —
    спредом от неё. Ожидаемые URL в `greenApiClient.test.ts` остаются литералами — это контракт
    транспорта, читать его строкой проще.
11. **`renderHookWithQueryClient`** — в `src/test/renderWithQueryClient.tsx` рядом с
    `renderWithQueryClient`, с общей приватной обёрткой.
12. **Favicon** — `public/favicon.svg` (простой SVG; цвет акцента — внутри ассета, не в SCSS);
    `<meta name="description">`.

## Сценарии использования

1. Вход с неверным токеном → текст ошибки → правка любого поля → текст ошибки исчезает.
2. Остальное — как до задачи: регресс `max-chat` §6 и `code-quality` §8 строки 6–8a.

## Критерии приёмки

- [x] **К1.** Текст 429 — одна константа: `grep -rn "Слишком частые" src --exclude-dir=__tests__` → только `apiErrorText.ts`; тексты сети разные, причина в комментарии — grep + `npx vitest run src/helpers`.
- [x] **К2.** Лимит сообщения: `grep -rn "4000" src --exclude-dir=__tests__` → только `helpers/message.ts`; `maxLength` поля и текст 400 берут константу — grep + тест `chatError`.
- [x] **К3.** «11–12»: `grep -rnE "11–12|length < 11|> 12" src --exclude-dir=__tests__` → только комментарий-контракт `types/greenApi.ts`; тесты `phone` и `ChatPage` (текст ошибки) зелёные.
- [x] **К4.** `formatIsoDateTime` с unit-тестом; `grep -rn toISOString src --exclude-dir=__tests__` → только `formatTime.ts`.
- [x] **К5.** `cx()` с unit-тестом; `grep -rnE "filter\(Boolean\)|className=\{\`" src` → только сам `helpers/cx.ts`.
- [x] **К6.** `IconButton` с тестом (имя из `label`, `svg` скрыт, `type=button` по умолчанию, `disabled`, клик, `ref`); «Назад» и «Отправить» — `IconButton`: `grep -rn "\.row \.send\|<button" src/pages` → только кнопка чата в `ChatList`; тесты `ChatPage` («Назад», отправка, фокус) зелёные.
- [x] **К7.** Кит на `ComponentProps`: `grep -rn "HTMLAttributes" src/components` → 0; `grep -rn namedItem src` → 0; тесты фокуса WM-07 (`LoginPage`, `ChatPage`) зелёные.
- [x] **К8.** SCSS: `grep -rn "outline: var(--focus-ring-width)" src` → только миксин; `grep -rn " color: var(--color-danger)" src` → только миксин (`border-color` рамки `Input` — не текст); `grep -rn "^\.icon" src/pages` → 0; длительностей литералом в `*.scss` вне `tokens/` нет; `npm run build` собирает SCSS.
- [x] **К9.** Тесты опроса используют экспортированные константы: в `useNotificationPolling.test.tsx` есть `RECEIVE_TIMEOUT_SECONDS`, `EMPTY_QUEUE_PAUSE_MS`, `RETRY_DELAYS_MS`, `MAX_RETRY_DELAY_MS`.
- [x] **К10.** `main.tsx` без `!`: при отсутствии `#root` — ошибка с понятным текстом; `grep -rn "'root')!" src` → 0, `npm run typecheck`.
- [x] **К11.** Ошибка входа сбрасывается при правке любого поля — новый тест `LoginPage` (401 → alert → ввод → alert нет).
- [x] **К12.** Неверные по смыслу комментарии исправлены (ссылки на skill/ресёрч/WM-NN остаются — Р3): `chatStore.ts:55` + что найдёт проход по комментариям `src/` (список — в «Итоге»); `grep -rn "WM-03 получит" src` → 0.
- [x] **К13.** `index.html`: favicon и `meta description`; после `npm run build` в `dist/` есть `favicon.svg`, ссылка в `dist/index.html` относительная. ✅ 2026-09-30: `href="./favicon.svg"`, `dist/favicon.svg` есть, в preview отдаётся 200.
- [x] **К14.** Фикстуры: `grep -rln "apiTokenInstance: 'test-token'" src` → только `src/test/fixtures.ts`.
- [x] **К15.** `grep -rn "new QueryClient" src/hooks/__tests__` → 0 (все через `renderHookWithQueryClient`).
- [x] **К16.** `grep -rn "Promise.resolve()\|no-await-in-loop" src --include=*.test.tsx` → 0; `useNotificationPolling.test.tsx` зелёный 3 прогона подряд.
- [x] **К17.** Новые тесты: Enter во время IME (`isComposing`) не отправляет; пустой номер → «Введите номер телефона», `aria-invalid`, фокус в поле, `CheckAccount` не вызван.
- [x] **К18.** Полный прогон зелёный: `npm run lint`, `format:check`, `typecheck`, `build`, `test:run -- --maxWorkers=2` (тестов больше 179). ✅ 2026-09-30: lint 0, format:check чисто, build — 107 модулей, test:run — 21 файл, 190 passed.
- [ ] **К19.** (не проверено — ждёт Диму) Вживую (Дима): регресс `max-chat` §6 (1, 5, 6, 8, 10, 11); `code-quality` §8 строки 6–8a (кольцо и фокус после переезда на `IconButton`/миксины) и строка 10 (сброс ошибки входа); в консоли нет 404 favicon (локально `npm run preview -- --port 5175 --strictPort`, на демо — после деплоя). *Локально без живого инстанса* — пройдено headless-приёмкой эпика (ресёрч `code-quality` §8 «Приёмка эпика после WM-08»); живой инстанс и демо — Дима.
- [x] **К20.** *(всплыло на приёмке эпика, 2026-09-30)* Ссылка на экране входа — с кольцом `--color-focus-ring`, а не с кольцом браузера: `a:focus-visible { @include focus-ring; }` в `styles/base/_global.scss` — headless: Tab на ссылку → `solid 3px rgb(26, 71, 184)`.

## Итог (доказательства, 2026-09-29)

- **К1–К10, К12, К14–К16 (grep «после»)**: 429 — только `apiErrorText.ts:3`; `4000` — только
  `message.ts:2`; «11–12» — только `types/greenApi.ts:15` (контракт API); `toISOString` — только
  `formatTime.ts`; `filter(Boolean)` — только `cx.ts`; `<button` в `pages/` — только `ChatList`;
  `HTMLAttributes` в ките и `namedItem` — 0; `outline: var(--focus-ring-width)` — только миксин
  `_a11y.scss`, цвет `--color-danger` у текста — только `_feedback.scss`; `.icon` в `pages/` — 0;
  длительностей литералом вне `tokens/` — 0; `'root')!` — 0; фикстура `test-token` — только
  `src/test/fixtures.ts`; `new QueryClient` в тестах хуков — 0; `Promise.resolve()` и
  `no-await-in-loop` в тестах — 0; константы опроса в тесте — все четыре.
- **Тесты**: `npx vitest run src/pages src/components src/helpers src/__tests__` — 124/124;
  `src/pages/LoginPage src/hooks src/services src/stores src/api src/helpers src/components` —
  154/154; `useNotificationPolling.test.tsx` — 21/21 три прогона подряд (К16).
- **Проверка, что новые тесты ловят поломку** (мутацией кода, потом откат): без `signIn.reset()`
  падает тест сброса ошибки входа (К11); без `!e.nativeEvent.isComposing` падает IME-тест (К17).
  Первая версия IME-теста проверяла `sendMessage` и отсутствие «Отправляем…» сразу после Enter —
  она проходила и на сломанном коде: TanStack Query зовёт `mutationFn` и оповещает о `pending`
  асинхронно. Теперь тест проверяет, что Enter не отменён (`fireEvent` → `true`): обработчик
  отменяет событие ровно тогда, когда отправляет.
- **К12, проход по комментариям `src/`**: `chatStore.ts:55` — «WM-03 получит эхо» → «эхо … может
  прийти и из очереди (вживую не проверено — ресёрч max-chat §2.4)»: приход эха в очередь HTTP API
  так и не проверен (`max-chat` §2.4), утверждать его как факт нельзя; `notification.ts:30` —
  «ресёрч §2.4» без имени ресёрча → «ресёрч max-chat §2.4»; `useCreateChat.ts:7` — дубль «11–12
  цифр» убран (правило — у `normalizePhone`). Остальные комментарии верны.
- `npm run typecheck` — чисто; `npm run lint` — код 0.

## Затрагиваемые файлы

- `src/helpers/` — `cx.ts`, `apiErrorText.ts`, `message.ts` (новые), `formatTime.ts`, `phone.ts`, `chatError.ts`, `signInError.ts` + тесты
- `src/styles/` — `tokens/_scale.scss`, `base/_global.scss` (кольцо у ссылок, К20), `mixins/_a11y.scss`, `mixins/_feedback.scss` (новый)
- `src/components/ui/` — `Button`, `Input`, `Avatar`, `IconButton` (новый, с тестом)
- `src/pages/` — `ChatPage`, `MessageComposer`, `MessageList`, `ChatList`, `NewChatForm`, `LoginPage` + тесты
- `src/main.tsx`, `src/stores/chatStore.ts`, `src/hooks/useCreateChat.ts`, `index.html`, `public/favicon.svg`
- `src/test/` — `fixtures.ts` (новый), `renderWithQueryClient.tsx`; 13 тестовых файлов
- `.claude/skills/frontend-patterns/SKILL.md`, `.research/code-quality/research.md`

## Что НЕ входит в скоуп

- Новые функции сверх ТЗ; поведение опроса и транспорта.
- Граница карточки поля ввода на градиенте (`code-quality` §9).
- Stylelint и сортировка импортов плагином (Р4, Р5).
- Удаление ссылок на skill/ресёрч/WM-NN из комментариев (Р3).
- `ChatList .empty` — не дубль плашки.

## Уровень риска

SAFE — UI, стили, тесты; запросы к GREEN-API не трогаем.
