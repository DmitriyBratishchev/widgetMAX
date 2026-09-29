# Tasks: Сдача: вёрстка, README, деплой

**Задача**: WM-04
**Спек**: `.specs/features/WM-04-delivery/spec.md`
**План**: `.specs/features/WM-04-delivery/plan.md`

> **Живой документ** — статусы и шаги обновляются по мере выполнения.

---

## Ф1: данные

- [x] сортировка и `closeChat` → `src/stores/chatStore.ts` + тесты
- [x] подпись аватара → `src/helpers/phone.ts` + тест

## Ф1: вёрстка

- [x] токены → `src/styles/tokens/`, `100dvh` → `src/styles/base/_global.scss`
- [x] `Avatar` → `src/components/ui/Avatar/`
- [x] шапки, `data-view`, узкий экран → `src/pages/ChatPage/ChatPage.tsx`
- [x] список, лента, поле ввода → `src/pages/ChatPage/*/`; кегль 16px на узком → `Input`, `MessageComposer`
- [x] `LoginPage` — проверен на 1280 и 390px, правок не потребовал
- [x] RTL: «Назад», сортировка → `src/pages/ChatPage/__tests__/ChatPage.test.tsx`

## Ф1: сдача

- [x] `base: './'` → `vite.config.ts`; workflow → `.github/workflows/deploy.yml` (actions: checkout v7,
      setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5 — последние релизы
      на 2026-09-29)
- [x] скриншоты → `docs/screenshots/`
- [x] README
- [x] ресёрч §5.4 / §6, `.claude/CLAUDE.md`

## Тесты

- [x] Точечно: `npx vitest run src/pages src/__tests__ src/stores src/helpers/__tests__/phone.test.ts`
      — зелёные (33 + 14), `npx tsc -p tsconfig.app.json --noEmit` — код 0, oxlint — 0, Prettier
      по изменённым файлам — чисто (2026-09-29)
- [x] Полный прогон — **только в `/finish`** (`rules.md` §6): `npm run lint` — 0, `npm run format:check`
      — чисто, `npm run build` — собрано, `npm run test:run -- --maxWorkers=2` — 19 файлов, 139 тестов
      зелёные (без ограничения воркеры падают по памяти машины — `plan.md` §«Грабли»), 2026-09-29

## Верификация

- [x] К1, К3 → `docs/screenshots/chat-wide.png` (две колонки, шапка сайдбара, аватары, время,
      «Назад» не видна) + тесты `ChatPage.test.tsx`, `App.test.tsx`
- [x] К2 → тест «Назад закрывает чат и возвращает к списку» + `narrow-list.png`, `narrow-chat.png`
- [x] К4 → `chatStore.test.ts` («новое сообщение поднимает свой чат…») + тест ChatPage «ответ в чат
      внизу списка поднимает его наверх»
- [x] К5 → таблица аудита `spec.md`; вход — `LoginPage.test.tsx`; новый чат, отправка, пустые
      состояния — `ChatPage.test.tsx` (describe «пустые состояния», «новый чат», «отправка»)
- [x] К6 → grep литералов / `@media` вне `tokens/`, `mixins/` и `style=` в `src` — пусто
- [x] К7 → `npm run build`: `./assets/…` в `dist/index.html`; `vite preview --base /widgetMAX/`:
      `/widgetMAX/`, JS и CSS — 200, экран чатов отрисован со стилями (скриншот в scratchpad)
- [x] К8 → ревью `deploy.yml`: секретов нет, `pages: write`, `id-token: write`, окружение `github-pages`
- [x] К9 → README: демо, стек, запуск, GREEN-API, как пользоваться, скриншоты, устройство, деплой
- [x] К10 → 4 PNG, данные фейковые (инстанс 1101000000, номера 7999…), без DevTools
- [x] К12 → по скриншоту web.max.ru от Димы: токены `--layout-feed-max-width: 700px`,
      `--layout-message-max-width: 488px`, `--chat-background` (градиент), `--shadow-composer`;
      `MessageComposer` — карточка в колонке ленты; скриншоты пересняты; тесты 33/33, `tsc` 0, grep
      К6 пуст, Prettier чисто
- [x] Замечание Димы: `FormEvent` устарел в `@types/react` 19.3 («doesn't actually exist») →
      `SubmitEvent<HTMLFormElement>` в `LoginPage`, `NewChatForm`, `MessageComposer`. Скан проекта через
      TypeScript Language Service (подсказки 6385/6387, как зачёркивание в редакторе): 0 устаревших API
      в `tsconfig.app.json` (52 файла) и `tsconfig.node.json`; сканер проверен на виртуальном файле с
      `FormEvent` — ловит. `strict` действует (умолчание TS 6.0), `tsc` 0, тесты 23/23
- [ ] К11 → Дима на публичном адресе после пуша и деплоя
- [x] Статус `spec.md`: В РАБОТЕ → ЗАВЕРШЕНО (К11 — открыт, ждёт Диму)

---

**Статусы**: ` ` не начато | `x` выполнено
