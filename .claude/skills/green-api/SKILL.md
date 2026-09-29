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
- **`apiUrl` у инстансов разный** — хардкодить один хост нельзя. На форме входа три поля:
  `idInstance`, `apiTokenInstance` и `apiUrl` (с разумным значением по умолчанию).
- Инстанс нужно авторизовать: в приложении MAX «Профиль → Устройства → Войти по QR-коду»,
  в кабинете — «Получить QR-код». Для входа по QR **пароль входа в MAX должен быть отключён**.
- Тариф Developer бесплатный: до 3 чатов — для задания хватает.

## 2. Методы

Общая форма URL: `{apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}`.
Префикс `/v3` необязателен — не используем. Тело — JSON, `Content-Type: application/json`.

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
- **`phoneNumber` в CheckAccount — число**, 11–12 цифр в международном формате без `+`
  (`79991234567`). Нормализация ввода (пробелы, скобки, `+`, ведущая `8`) — чистая функция в
  `helpers/`.
- **`message`** — до 4000 символов; длиннее → 400. Пустое/пробельное не отправляем.

## 3. Приём: очередь HTTP API

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
- Очередь хранит 24 часа старых событий: после первого входа цикл может «вычерпать» накопленное.
  Показываем только события чатов, открытых в UI, а остальные просто удаляем.

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

## 6. Лимиты и ошибки

- Превышение частоты → **429**. Лимиты на инстанс: SendMessage 50/с, Receive/DeleteNotification
  100/с, CheckAccount 10/с, **GetStateInstance и прочие методы аккаунта — 1/с** (не опрашивать
  статус в цикле).
- CheckAccount: 400 — неверный формат номера (не цифры, не 11–12 цифр); **469** — лимит проверок
  контактов, пауза 2 часа (на Developer всего 100 проверок).
- SendMessage: 400 — валидация (длина > 4000 и т.п.); 403 — ограничение аккаунта; 500 —
  тело > 100 КБ.
- Неверные `idInstance`/`apiTokenInstance` — код ответа **не проверено** (ожидается 401/403);
  на входе сообщать «неверные учётные данные или инстанс».
- **CORS** для запросов из браузера напрямую к `apiUrl` — **не проверено**. Сверить первым же
  запросом; если браузер блокирует — решение (прокси dev-сервера Vite + деплой с прокси)
  согласовать с Димой.

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
