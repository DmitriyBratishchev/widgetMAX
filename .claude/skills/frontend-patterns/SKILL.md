---
name: frontend-patterns
description: Стиль и правила SPA widgetMAX (React 19 / TS / Vite) — структура src/, именование и импорты, контракт владения (кто ходит в GREEN-API, кто владеет состоянием), TanStack Query vs Zustand, стили и токены, тесты Vitest. Использовать при любой работе в src/.
---

# widgetMAX: React / TypeScript — детальные правила

> Ядро — `.claude/rules.md`; всё про API мессенджера — skill `green-api`.

---

## Структура кода

```
src/
├── api/            транспорт: клиент GREEN-API (сборка URL из учётных данных, разбор ошибок)
├── services/       плоско, <домен>Service.ts — по методу GREEN-API на функцию
├── hooks/          плоско, use<Что>.ts — useMutation, цикл опроса уведомлений
├── helpers/        плоско, чистые функции (телефон, разбор уведомлений, форматирование времени)
├── stores/         плоско, Zustand
├── types/          ТОЛЬКО wire-типы GREEN-API (контракт API)
├── pages/          плоско, <Name>Page/ + локальные подкомпоненты рядом
├── components/
│   ├── ui/         кит: примитивы (Button, IconButton, Input, Avatar)
│   └── <домен>/    доменные компоненты: auth, chat
├── styles/         index.scss + tokens/ mixins/ base/
├── test/           setup.ts (jest-dom + cleanup), fixtures.ts, рендер с QueryClient
├── __tests__/      тест App
├── queryClient.ts  единственный QueryClient (мутации без retry)
├── main.tsx        точка входа: стили, StrictMode, QueryClientProvider
└── App.tsx         выбор экрана (вход / чат) — без роутера, по признаку входа из стора
```

- `api/` — **один** клиент GREEN-API; второго транспорта не заводим
- `helpers/` — без React и стейт-менеджмента; покрываются unit-тестами
- `types/` — только форма запросов/ответов API. Пропсы — рядом с компонентом, типы стора — в
  файле стора
- Домен в `components/` заводится при ≥2 компонентах; меньше — компонент живёт в папке страницы

### Именование и импорт

- **`папка = имя компонента = имя файла`**:
  `components/<домен>/<Name>/<Name>.tsx` + `<Name>.module.scss` + `__tests__/<Name>.test.tsx`
- **барел-файлы `index.ts` запрещены** — импорт указывает на файл-владелец символа. Причина:
  «grep по имени символа → ровно один файл»
- **только именованные экспорты** (исключение — `export default App`)
- импорт через `@/`; относительный путь — только на соседний файл и на `.module.scss`
- `import type` для type-only импортов

### Кит `components/ui/`

- Пропсы — `ComponentProps<'button'>` / `<'input'>` плюс свои: `ref` в React 19 — обычный проп и
  уходит спредом на элемент. У `Input` `className` — на корень поля (подпись + поле + ошибка),
  `ref` и остальные атрибуты — на `<input>`.
- Кнопка без текста — `IconButton`: `label` обязателен (станет `aria-label`), `children` — контуры
  иконки 24×24. Своих `<button>` со стилями кнопки в страницах не заводим.
- Классы склеивает `cx()` из `helpers/cx.ts` — не шаблонная строка и не `filter(Boolean).join`.
- Показать/спрятать компонент кита по раскладке — обёрткой страницы, а не классом на самом
  компоненте: иначе спор специфичности с базовым классом кита.

### `pages/`

Папка-на-экран (вход, чат). Подкомпоненты страницы лежат в её папке и переезжают в
`components/<домен>/` при появлении **второго** потребителя. Кросс-импорт `pages/A → pages/B` —
ошибка.

## Состояние

### Матрица владения

| Слой | Может | Не может |
|---|---|---|
| `api/` | транспорт, сборка URL, нормализация ошибок | знать о чатах, писать в сторы |
| `services/` | вызывать клиент `api/`, знать эндпоинты и wire-типы | React, TanStack, сторы |
| `hooks/` | **единственный** слой с `useMutation`/`useQuery` и циклом опроса; пишет в сторы | JSX |
| `stores/` | сессия, чаты и сообщения, UI-состояние | транспорт, вызовы сервисов |
| `components/ui/` | пропсы и локальный `useState` | хуки данных, сторы, сервисы |
| `components/<домен>/` | хуки из `hooks/`, чтение сторов селектором | транспорт, сервисы напрямую |
| `pages/` | оркестрация и композиция | всё, что запрещено домену |

### Что где живёт

- **Zustand `session`** — учётные данные (`idInstance`, `apiTokenInstance`, `apiUrl`) и признак
  входа. Токен из стора читают только `hooks/` (передают в сервис) — компоненты его не видят.
- **Zustand `chat`** — список чатов и сообщения по `chatId`. Это журнал, собранный на клиенте из
  ответов `SendMessage` и уведомлений очереди; перечитать его с сервера нечем, поэтому он в сторе,
  а не в кеше Query.
- **TanStack Query** — операции-запросы: `useMutation` на отправку, проверку номера
  (`CheckAccount`), проверку инстанса при входе (`GetStateInstance`). Отказ отображается из
  состояния мутации, а не `try/catch` в компоненте.
- **Опрос уведомлений** — отдельный хук с последовательным циклом (не `refetchInterval`):
  порядок `receive → обработать → delete → следующий receive` и остановка по выходу —
  skill `green-api` §3. Если цикл встал насовсем (401/403, ошибка в коде), хук **возвращает**
  причину, а плашку рисует страница: это состояние живого цикла, не данные сессии — в стор его не
  кладём (WM-06).
- **Ответ после «Выйти»** в стор не пишем: мутация после `await` в `mutationFn` сверяет
  `credentials` момента запуска с текущими (`isCurrentSession` из `sessionStore.ts`) и иначе
  бросает `SessionEndedError` — `onSuccess` не срабатывает (WM-06).

### Подписка

- React Context не заводим — глобальное состояние в Zustand.
- Подписка на стор — **строго селектором на поле**: `useChatStore((s) => s.activeChatId)`.
  Деструктуризация стора целиком запрещена: перерисовка на любое изменение любого поля.

## TypeScript

- По ходу работы: **`npm run typecheck`** (`tsc -b` — оба проекта: `src/` и `vite.config.ts`).
  Голый `tsc --noEmit` в шаблоне Vite проверяет 0 файлов: корневой `tsconfig.json` —
  solution-style (`"files": []` + `references`), без `-b` компилируется пустое множество с кодом 0.
- `npm run build` (там тот же `tsc -b`) — только в `/finish`.
- Флаги сверх `strict`: `noUncheckedIndexedAccess` — индекс массива и записи даёт `T | undefined`.
  В коде — `?? запасное` или явная проверка, не `!`; в тестах — `assert.isDefined(x)` из `vitest`
  (сужает тип). Плюс `noImplicitReturns`, `noImplicitOverride`.
- Линтер по типам (`npm run lint`): устаревшее (`no-deprecated`), `any` из `JSON.parse` и прочего
  (`no-unsafe-*` — разбирать в `unknown` и сужать), неполный `switch` по союзу без `default`,
  потерянные промисы. Намеренное нарушение — `// eslint-disable-next-line <правило> -- причина`.

## Стили

```
styles/
├── index.scss      единственная точка входа, её импортирует main.tsx
├── tokens/         палитра, семантика, шкала отступов/кеглей/радиусов
├── mixins/         breakpoints и общие миксины
└── base/           reset, typography, global
```

- Визуальный образец — https://web.max.ru/: список чатов слева, лента сообщений справа,
  поле ввода снизу. Копируем раскладку и характер, а не пиксели и не бренд.
- **Литералы цвета, кегля и радиуса — только в `styles/tokens/`**, везде ещё `var()`;
  компоненты видят семантический слой (`var(--color-surface)`), не палитру
- **`@media` — только в `styles/mixins/breakpoints.scss`**, в компонентах — `@include`
- Общие миксины: `focus-ring` и `visually-hidden` (`_a11y.scss`), `error-text` и `placeholder` —
  плашка пустого состояния на градиенте (`_feedback.scss`). Кольцо фокуса и текст ошибки руками не
  пишем. Длительности переходов — токены (`--duration-fast`)
- Никаких inline-стилей
- Обязательные состояния экрана: пусто (нет чатов / нет сообщений), загрузка, ошибка с
  понятным текстом; кнопка отправки недоступна при пустом тексте и во время отправки

## Тестирование (Vitest + React Testing Library)

```bash
npx vitest run <файл>                     # по ходу работы — только затронутое
npm run typecheck                         # типы, дёшево
npm run lint                              # oxlint с правилами по типам
npm run test:run -- --maxWorkers=2        # весь набор — ТОЛЬКО в /finish
npm run build                             # сборка — ТОЛЬКО в /finish
```

**Обязательное покрытие**:
- `helpers/` → unit (нормализация телефона, разбор уведомления в сообщение)
- цикл опроса → порядок receive/delete, удаление «чужих» уведомлений, остановка
- компонент с логикой → тест взаимодействий (отправка, валидация формы входа и нового чата)

Сеть не ходит: мокаем функции `services/` (`vi.mock`), а не `fetch` внутри транспорта.

- Мок — с типом: `vi.mock('@/services/chatService', () => ({ sendMessage: vi.fn<typeof sendMessage>() }))`
  (`vitest/require-mock-type-parameters`); `typeof` импортированной функции — только тип, подъём
  `vi.mock` не мешает.
- Моки сбрасывает конфиг (`mockReset: true` в `vite.config.ts`): перед каждым тестом `vi.fn()` —
  пустая функция, `vi.fn(impl)` — снова `impl`. Ручной `mockReset()` в `beforeEach` не пишем.
- Без условий внутри `it` (`vitest/no-conditional-in-test`): ветвление — в хелпере модуля.
  Состояние persist-сторов — `readPersistedState(key)` из `src/test/persistedState.ts`.

Учётные данные в тестах — заведомо фейковые: `TEST_CREDENTIALS` из `src/test/fixtures.ts`
(`idInstance: '1101000000'`, `apiTokenInstance: 'test-token'`); варианты — спредом от неё.
Компонент с запросами — `renderWithQueryClient(ui)`, хук с мутацией —
`renderHookWithQueryClient(() => useХук())` (`src/test/renderWithQueryClient.tsx`, свежий клиент
без retry). Цикл промисов под фейковыми таймерами прокручивает `vi.advanceTimersByTimeAsync(0)`
(`useNotificationPolling.test.tsx`, `settle()`), а не серия `await Promise.resolve()`; `vi.waitFor`
под фейковыми таймерами сам двигает время на `interval` — точные окна пауз он ломает.
