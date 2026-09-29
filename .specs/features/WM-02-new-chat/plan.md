# Plan: Новый чат и отправка

**Задача**: WM-02
**Ветка**: `feature/WM-02-new-chat`
**Уровень риска**: CAUTION
**Спек**: `.specs/features/WM-02-new-chat/spec.md`
**Ресёрч**: `.research/max-chat/research.md` (§5.2, §2.4, §6)

> **Живой документ** — шаги дописываются **накопительно** (отмечать сделанное, не
> переписывать историю плана).

---

## Карта фаз

| Фаза | Цель | Трогает GREEN-API | Критерии | Статус |
|------|------|-------------------|----------|--------|
| **Ф1** | новый чат и отправка: данные + UI | да | К1–К14 | **VERIFIED** (2026-09-29) — К1–К12, К14 тестами и скриншотами, К13 на живом инстансе |

---

## Ф1 — новый чат и отправка

### Шаги: данные

1. [x] `src/types/greenApi.ts` — `CheckAccountRequest { phoneNumber: number }`,
   `CheckAccountResponse { exist; chatId; fromCache? }`, `SendMessageRequest { chatId; message }`,
   `SendMessageResponse { idMessage }`.
2. [x] `src/services/chatService.ts` — `checkAccount(credentials, phoneNumber: number)`,
   `sendMessage(credentials, { chatId, message })` через `greenApiRequest` с `httpMethod: 'POST'`.
3. [x] `src/helpers/phone.ts` — `normalizePhone(input): string | null`, `formatPhone` для показа
   (`+79991234567`). `src/helpers/formatTime.ts` — `formatMessageTime(ms)` → `ЧЧ:ММ`.
4. [x] `src/helpers/chatError.ts` — `AccountNotFoundError`, `getCreateChatErrorMessage(error)`,
   `getSendMessageErrorMessage(error)` (по образцу `src/helpers/signInError.ts`).
5. [x] `src/stores/chatStore.ts` — типы `Chat { chatId; phone }`, `ChatMessage { idMessage; chatId;
   text; direction: 'incoming' | 'outgoing'; timestamp }`; состояние `chats`, `messagesByChatId`,
   `activeChatId`; действия `addChat` (upsert + активный), `selectChat`, `addMessage` (дедуп),
   `reset`; `persist` в `sessionStorage`, ключ `widgetmax-chat`.
6. [x] `src/hooks/useCreateChat.ts` — номер уже в `chats` → вернуть его; иначе
   `checkAccount(credentials, Number(phone))` → `!exist || !chatId` → `throw AccountNotFoundError`;
   `onSuccess` → `addChat`. `src/hooks/useSendMessage.ts` — `sendMessage` → `ChatMessage` из
   `idMessage`, `onSuccess` → `addMessage`. `src/hooks/useSignOut.ts` — `reset()` чатов +
   `signOut()` сессии.

### Шаги: UI

Подкомпоненты — в папке страницы: второго потребителя нет (skill `frontend-patterns` §`pages/`).

7. [x] `src/styles/tokens/` — недостающие токены (фон ленты, активный чат, ширина пузыря, высота
   поля ввода).
8. [x] `src/pages/ChatPage/NewChatForm/` — `Input` «Номер телефона», валидация через
   `normalizePhone`, «Создать чат»/«Проверяем…», ошибка API в `role="alert"`, очистка при успехе.
9. [x] `src/pages/ChatPage/ChatList/` — `<ul>` кнопок чатов (номер + превью последнего
   сообщения), `aria-current` у активного; пусто → «Чатов пока нет…».
10. [x] `src/pages/ChatPage/MessageList/` — пузыри входящих/исходящих, `white-space: pre-wrap`,
    время; автоскролл вниз; пусто → «Сообщений пока нет…».
11. [x] `src/pages/ChatPage/MessageComposer/` — `<textarea aria-label="Сообщение" maxLength={4000}>`,
    Enter/Shift+Enter, «Отправить» недоступна при пустом тексте и во время отправки, очистка при
    успехе, ошибка в `role="alert"`; `key={chatId}` — черновик не переезжает в другой чат.
12. [x] `src/pages/ChatPage/ChatPage.tsx` — шапка («Выйти» → `useSignOut`) + `aside` (форма +
    список) и область чата (шапка с номером, лента, поле) или «Выберите чат…».
13. [x] Тесты: слои данных (К1–К6), `ChatPage.test.tsx` (К8–К11), `App.test.tsx` (К7).
14. [x] Headless-скриншоты (К12): `npm run dev` + Edge headless через CDP-скрипт в scratchpad
    (вне репо), фейковые сессия и чаты в `sessionStorage`; реальный 401 от `checkAccount` на
    `3100000000`/`test-token`.

### Шаги: документы

15. [x] Ресёрч §5.2 — решение про `sessionStorage`; §6 — новые строки чек-листа; skill `green-api`
    §5/§6 — `chatId: ""` при `exist: false`, 466, 400 по таймауту проверки (по документации).

### Шаги: доработка по замечанию Димы (2026-09-29)

16. [x] `NewChatForm` — номер после нормализации уже в списке → кнопка «Перейти в чат» вместо
    «Создать чат» (селектор `isKnownPhone` по стору `chat`); тест в `ChatPage.test.tsx` (К14),
    строка 6b чек-листа §6.

### Ключевые решения

- Ключ чата — `chatId` из `CheckAccount`, телефон — только подпись (иначе ответ из MAX в WM-03
  ляжет в другой чат).
- Отказ `exist: false` бросает хук → UI читает только `mutation.error` (как WM-01).
- Повтор номера — без `CheckAccount`: лимит 100 проверок на Developer, 469 = пауза 2 ч.
- Сообщение в ленту — из ответа `SendMessage`, не оптимистично; дедуп по `idMessage` в сторе
  готовит WM-03 к эху `outgoingAPIMessageReceived`.
- Сброс чатов при выходе — в хуке `useSignOut`, сторы друг о друге не знают.
- Стор `chat` в `sessionStorage` — решение Димы 2026-09-29 (`spec.md` §«Решение»).
- Для CheckAccount код 403 не документирован — отдельного текста нет, уходит в общий «Не удалось
  создать чат»; 403 у SendMessage — ограничение аккаунта (по документации).

### Грабли

- Селектор Zustand с `?? []` возвращает новый массив на каждый вызов → бесконечная перерисовка.
  Пустое значение — константа модуля (`NO_MESSAGES` в `MessageList`).
- Порт 5173 может быть занят dev-сервером Димы — для скриншотов свой сервер на 5174
  (`--strictPort`), чужой процесс не трогаем.
- Для скриншотов состояний после входа учётные данные и чаты кладутся в `sessionStorage` через
  CDP до перезагрузки страницы; реальный запрос — только с фейковым инстансом (401, лимит
  проверок не тратится).

### Проверка (DoD)

- **Команда**: `npx vitest run` + `npx tsc -p tsconfig.app.json --noEmit` + скриншоты `npm run dev`
- **Ожидаемый результат**: тесты зелёные, `tsc` — код 0, на скриншотах раскладка, пустые
  состояния, лента с сообщениями и текст ошибки

---

## Тесты

- [x] Точечно по ходу: `npx vitest run <файл>`, `npx tsc -p tsconfig.app.json --noEmit` —
      16 файлов, 91 тест зелёные, `tsc` код 0, oxlint и Prettier чистые (2026-09-29)
- [x] Полный прогон — **только в `/finish`** (`rules.md` §6):
      `npm run lint` + `npm run format:check` + `npm run build` + `npm run test:run` — зелёные, 2026-09-29 (91 тест)
