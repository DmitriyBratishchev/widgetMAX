---
name: green-api
description: GREEN-API для мессенджера MAX — учётные данные инстанса, методы SendMessage / CheckAccount / GetStateInstance / ReceiveNotification / DeleteNotification, форматы chatId и уведомлений, очередь HTTP API, лимиты и грабли. Использовать при любой работе с запросами к GREEN-API, опросом уведомлений, чатами и сообщениями.
---

# GREEN-API (MAX) в widgetMAX

> Сведено по документации v3 (https://green-api.com/v3/docs/) на 2026-09-29. Помеченное
> **«не проверено»** сверить на живом инстансе и снять пометку.

## 1. Доступ и учётные данные

- В личном кабинете (https://console.green-api.com/instanceList) у инстанса есть:
  `idInstance` (номер инстанса), `apiTokenInstance` (ключ доступа, **секрет**, можно сменить),
  `apiUrl` (хост API, вида `https://3100.api.green-api.com`), `mediaUrl` (хост загрузки файлов —
  нам не нужен).
- **`apiUrl` у инстансов разный** — хардкодить один хост нельзя. Хост определяется **первыми 4
  цифрами `idInstance`**: `3100000000` → `https://3100.api.green-api.com`. Проверено 2026-09-29
  фейковыми данными: на «своём» хосте инстанс получает `401`, на чужом `404`, а хоста `1101.` не
  существует (`.research/max-chat/research.md` §2.2). **На живом инстансе MAX подтверждено**
  (2026-09-29): подставленный адрес совпал с `apiUrl` в кабинете. `idInstance` реального
  инстанса — 12 цифр, длину не ограничиваем. На форме входа `apiUrl` подставляется из
  `idInstance`, пока пользователь не поправил поле сам. Работает ли общий `api.green-api.com` для
  реальных инстансов MAX — **не проверено**.
- Инстанс нужно авторизовать: в приложении MAX «Профиль → Устройства → Войти по QR-коду»,
  в кабинете — «Получить QR-код». Для входа по QR **пароль входа в MAX должен быть отключён**.
- Тариф Developer бесплатный: до 3 чатов — для задания хватает.

## 2. Методы

Общая форма URL: `{apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}`.
Префикс `/v3` необязателен — не используем. Тело — JSON, `Content-Type: application/json`.
Параметры строки запроса и доп. сегменты пути идут **после токена** — в транспорте
`src/api/greenApiClient.ts` это опции `query` (`…/{token}?receiveTimeout=20`) и `pathSuffix`
(`…/{token}/{receiptId}`), с WM-03.

| Метод | HTTP | Путь | Тело / параметры | Ответ |
|---|---|---|---|---|
| GetStateInstance | GET | `getStateInstance` | — | `{ stateInstance }` |
| CheckAccount | POST | `checkAccount` | `{ phoneNumber: number, force?: boolean }` | `{ exist, chatId, fromCache }` |
| SendMessage | POST | `sendMessage` | `{ chatId, message, quotedMessageId?, typingTime? }` | `{ idMessage }` |
| ReceiveNotification | GET | `receiveNotification?receiveTimeout=N` | `receiveTimeout` 5–60 с, по умолчанию 5 | `{ receiptId, body }` или `null` |
| DeleteNotification | DELETE | `deleteNotification/{apiTokenInstance}/{receiptId}` | — | `{ result: boolean, reason }` |

- **`stateInstance`**: `authorized` — можно работать; `notAuthorized`, `blocked`, `starting`,
  `suspended`, `pendingPassword` — на входе показать понятную причину. Вход = успешный
  `GetStateInstance` со статусом `authorized`; он же проверяет, что учётные данные верны.
  Проверено на живом инстансе MAX (2026-09-29): до сканирования QR — `notAuthorized`, после —
  `authorized`; частые повторы входа дают `429` (лимит 1 запрос/с).
- **`phoneNumber` в CheckAccount — число**, 11–12 цифр в международном формате без `+`
  (`79991234567`), поддерживаются коды 7 и 375. Нормализация ввода (пробелы, скобки, `+`, ведущая
  `8`) — `normalizePhone` в `src/helpers/phone.ts`. При `exist: false` по документации
  `chatId: ""`. На живом инстансе MAX (2026-09-29): номер без MAX → `exist: false` отработал как
  «нет аккаунта»; `chatId` при `exist: true` годится для `SendMessage` — сообщение дошло, и
  **совпадает с `senderData.chatId` входящего** (WM-03, ответ из MAX лёг в чат, созданный по
  `CheckAccount`). Точный вид значения глазами не смотрели.
- **`message`** — до 4000 символов; длиннее → 400. Пустое/пробельное не отправляем.

## 3. Приём: очередь HTTP API

Для MAX технологий приёма **две**: HTTP API (очередь) и Webhook Endpoint (GREEN-API сам шлёт
POST на публичный сервер). **WebSocket для уведомлений нет** — он есть только для QR-кода при
авторизации инстанса. У SPA без бэкенда вебхук принять некуда, поэтому остаётся очередь
(сверено по https://green-api.com/v3/docs/api/receiving/ 2026-09-29).

Все входящие события лежат в очереди инстанса **24 часа**, выдаются строго по одному в порядке
FIFO. Цикл опроса:

```
loop:
  n = receiveNotification(receiveTimeout)   // long-poll: держит запрос до N секунд
  if n == null: continue                    // очередь пуста
  обработать n.body                          // в стор чатов, если это наше событие
  deleteNotification(n.receiptId)            // ВСЕГДА, даже если событие проигнорировали
```

- **Удалять каждое уведомление**, включая неинтересные (`stateInstanceChanged`, статусы,
  нетекстовые сообщения). Не удалённое уведомление останется первым в очереди, и цикл будет
  получать его бесконечно, а новые сообщения — никогда.
- **Строго последовательно, один цикл на приложение.** Параллельные `receive` получат одно и то же
  уведомление. Guard от двойного запуска в StrictMode, остановка через `AbortController` при
  выходе и размонтировании.
- Ошибка сети или 429 → пауза (backoff) и продолжение цикла, без падения и без «горячего»
  цикла.
- **Конфликт с вебхуком**: HTTP API работает, только если в настройках инстанса **пустой
  `webhookUrl`**. Если там задан URL, очистить его в кабинете (или `SetSettings`) и подождать
  около минуты. Флаги типов уведомлений: `incomingWebhook: "yes"` обязателен (без него ответы
  не придут); `outgoingWebhook`, `stateWebhook` документация тоже включает в примере.
- **У нового инстанса MAX все уведомления выключены** (кабинет, 2026-09-29, WM-03): очередь пуста,
  ответы не приходят, хотя цикл работает. В кабинете, блок «Уведомления»: «Получать уведомления о
  входящих сообщениях и файлах» = `incomingWebhook`, «…отправленных с телефона» =
  `outgoingWebhook`, «…отправленных с API» = `outgoingAPIMessageWebhook` (эхо, приложению не
  нужно). «Адрес отправки уведомлений (URL)» = `webhookUrl` — оставить пустым.
- Очередь хранит 24 часа старых событий: после первого входа цикл может «вычерпать» накопленное.
  Показываем только события чатов, открытых в UI, а остальные просто удаляем.
- В widgetMAX (WM-03): цикл — `src/hooks/useNotificationPolling.ts` (запускает `ChatPage`),
  разбор тела в сообщение — `parseNotification` в `src/helpers/notification.ts` (не бросает на
  кривых данных — иначе цикл не дошёл бы до `delete`). `receiveTimeout = 20` с, пауза после
  ошибки `1 → 2 → 4 → 8 → 16 → 30 с`.
- **Грабли (живой инстанс MAX, 2026-09-29):** пока у инстанса выключены все уведомления, пустой
  ответ `ReceiveNotification` приходит за миллисекунды, хотя `receiveTimeout=20`, — цикл без своей
  паузы шлёт сотни запросов в секунду. С включёнными уведомлениями long-poll работает: запрос
  висит 20 с (параметр — в секундах). На сервер как на гарантию паузы всё равно не полагаемся:
  после пустого ответа цикл сам ждёт 1 с; `DeleteNotification` с `result: false` — ошибка с
  паузой (иначе то же уведомление приходит снова без паузы).

## 4. Формат уведомлений

```json
{
  "receiptId": 1234567,
  "body": {
    "typeWebhook": "incomingMessageReceived",
    "instanceData": { "idInstance": 3100000000, "wid": "79991234567@c.us", "typeInstance": "v3" },
    "timestamp": 1763115112,
    "idMessage": "1763115112345",
    "senderData": {
      "chatId": "10000000", "chatName": "…", "chatType": "user",
      "sender": "10000000", "senderName": "…", "senderPhoneNumber": 79876543210
    },
    "messageData": {
      "typeMessage": "textMessage",
      "textMessageData": { "textMessage": "Привет!" }
    }
  }
}
```

| `typeWebhook` | Что это | Что делаем |
|---|---|---|
| `incomingMessageReceived` | входящее сообщение | добавить в чат `senderData.chatId` как входящее |
| `outgoingAPIMessageReceived` | эхо нашего же `SendMessage` | дедуп по `idMessage` (уже добавлено из ответа отправки) |
| `outgoingMessageReceived` | отправлено с телефона владельца инстанса | добавить как исходящее, если чат открыт |
| `outgoingMessageStatus`, `stateInstanceChanged`, прочее | статусы, состояние | удалить из очереди |

Текст по `typeMessage`:
- `textMessage` → `messageData.textMessageData.textMessage`
- `extendedTextMessage` (текст со ссылкой) → `messageData.extendedTextMessageData.text`
  (**не проверено** для MAX, путь по аналогии с WhatsApp-версией)
- `quotedMessage` (ответ с цитатой) → текст в `extendedTextMessageData.text` (**не проверено**)
- остальное (медиа, контакты, опросы) — вне скоупа: удалить из очереди без отображения

`timestamp` — Unix-секунды (умножить на 1000 для `Date`).

## 5. chatId и новый чат

- Форматы: личный чат — числовая строка `"10000000"`; группа — отрицательная `"-10000000000000"`;
  номер телефона — `"79991234567@c.us"` (только коды 7 и 375).
- **Ключ чата — числовой `chatId`, а не телефон.** Входящее от собеседника приходит с числовым
  `senderData.chatId`. Если завести чат по `79991234567@c.us`, ответ ляжет в «другой» чат.
  Поэтому новый чат: номер → `CheckAccount` → `exist: false` показываем как «нет аккаунта в
  MAX»; `exist: true` → чат с полученным `chatId`, дальше `SendMessage` на него. Так же советует
  документация GREEN-API.
- В widgetMAX (WM-02): номер, чат которого уже есть в списке, открывается **без** повторного
  `CheckAccount` — лимит проверок (§6) не тратится. Реализация — `src/hooks/useCreateChat.ts`.

## 6. Лимиты и ошибки

- Превышение частоты → **429**. Лимиты на инстанс: SendMessage 50/с, Receive/DeleteNotification
  100/с, CheckAccount 10/с, **GetStateInstance и прочие методы аккаунта — 1/с** (не опрашивать
  статус в цикле).
- CheckAccount: 400 — неверный формат номера (не цифры, не 11–12 цифр) или «check phone number
  timeout limit exceeded»; **469** — лимит проверок контактов, пауза 2 часа (на Developer всего
  100 проверок).
- **466** — превышены ограничения тарифа Developer (в т.ч. больше 3 чатов); касается методов,
  открывающих новую переписку. По документации, на живом инстансе **не проверено**.
- SendMessage: 400 — валидация (длина > 4000 и т.п.); 403 — ограничение аккаунта; 500 —
  тело > 100 КБ.
- Неверный `apiTokenInstance` → **401 с пустым телом** (`Content-Length: 0`); инстанс не с этого
  хоста → **404** с HTML nginx. Ошибку определяем по статусу, тело ответа с ошибкой **не
  разбираем** как JSON. Проверено 2026-09-29 фейковыми данными (`.research/max-chat/research.md`
  §2.3).
- **CORS открыт**: `Access-Control-Allow-Origin: *`, preflight разрешает `POST` и `DELETE` с
  заголовком `Content-Type` — SPA ходит в GREEN-API напрямую, прокси не нужен. Проверено
  2026-09-29 на `api.green-api.com` и `3100.api.green-api.com` (§2.1 ресёрча).

## 7. Источники

- Отправка: https://green-api.com/v3/docs/api/sending/SendMessage/
- Приём HTTP API: https://green-api.com/v3/docs/api/receiving/technology-http-api/
  (+ `ReceiveNotification/`, `DeleteNotification/`)
- Формат уведомлений: https://green-api.com/v3/docs/api/receiving/notifications-format/
- chatId: https://green-api.com/v3/docs/api/chat-id/
- CheckAccount: https://green-api.com/v3/docs/api/service/CheckAccount/
- Состояние: https://green-api.com/v3/docs/api/account/GetStateInstance/
- Лимиты: https://green-api.com/v3/docs/api/ratelimiter/
- Начало работы: https://green-api.com/v3/docs/before-start/
