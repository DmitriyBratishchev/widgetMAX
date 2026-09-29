# Приём сообщений

**Статус**: ЗАВЕРШЕНО
**Задача**: WM-03
**Дата**: 2026-09-29
**Масштаб**: среднее
**Ресёрч**: `.research/max-chat/research.md` — §5.3 (скоуп), §2.4 (не проверено), §6 (чек-лист)

> **Живой документ** — дополняется по ходу выполнения (критерии/скоуп/статус). Если фаза
> выявила изменение задачи или эпика — правку внести здесь и/или в ресёрч (`rules.md` §3).
>
> **Статусы**: ЧЕРНОВИК → УТВЕРЖДЕНО → В РАБОТЕ → ЗАВЕРШЕНО. В `ЗАВЕРШЕНО` переводим
> только на **последней** фазе задачи, когда все критерии `[x]`.

---

## Проблема

Приложение только отправляет (WM-02): очередь уведомлений GREEN-API никто не читает, и ответ
собеседника из MAX в чате не появляется — не закрыты шаги 4–5 сценария приёмки
(`.docs/requirements.md`: «получатель отвечает на сообщение в MAX», «ответ появляется в чате»).
`MessageList` уже рисует `direction: 'incoming'`, но таких сообщений нет.

## Решение

Очередь HTTP API и формат уведомлений — skill `green-api` §3–§4, скоуп — ресёрч §5.3.

- **Транспорт** `src/api/greenApiClient.ts`: опции `query` и `pathSuffix`. URL —
  `{apiUrl}/waInstance{id}/{method}/{token}[/{pathSuffix}][?query]`: у `ReceiveNotification`
  параметр `receiveTimeout` идёт **после** токена, у `DeleteNotification` `receiptId` — сегментом
  пути после токена (skill `green-api` §2). Текст ошибки — как раньше, только метод и статус.
- **Сервис** `src/services/notificationService.ts`: `receiveNotification(credentials,
  receiveTimeout, signal)` → GET, ответ `{ receiptId, body }` или `null`;
  `deleteNotification(credentials, receiptId, signal)` → DELETE.
- **Wire-типы** уведомлений в `src/types/greenApi.ts`. Поля тела опциональны: это данные из сети,
  разбор защитный.
- **Разбор** `src/helpers/notification.ts` — `parseNotification(body: unknown): ChatMessage | null`,
  тотальная функция (не бросает — иначе кривое уведомление не дошло бы до `delete` и очередь
  встала бы): `incomingMessageReceived` → входящее; `outgoingMessageReceived` (с телефона
  владельца) и `outgoingAPIMessageReceived` (эхо своей отправки) → исходящее, дубль эха отсекает
  стор по `idMessage` (с WM-02); `chatId` — `String(senderData.chatId)`; текст — по
  `typeMessage` (`textMessage`, `extendedTextMessage`); `timestamp` × 1000. Медиа, статусы,
  `stateInstanceChanged`, неполные и мусорные данные → `null`.
- **Цикл** `src/hooks/useNotificationPolling.ts` — один последовательный цикл
  `receive → обработать → delete → receive`, не `refetchInterval`:
  - эффект по `credentials` сессии, свой `AbortController`, cleanup → `abort()`. Это и есть guard
    StrictMode: повторный mount обрывает первый цикл, а `receive` из очереди не удаляет — оборванный
    запрос ничего не теряет;
  - после каждого `await` проверяется `signal.aborted`: после «Выйти» старый цикл в стор не пишет;
  - сообщение попадает в стор, только если его `chatId` есть в списке чатов; **каждое**
    уведомление удаляется (чужие, нераспознанные, эхо);
  - `receiveTimeout = 20` с (документация: 5–60) — long-poll вместо частых запросов; `null`
    (очередь пуста) → пауза 1 с и следующий `receive` (~~сразу~~ — см. К11: при выключенных в
    кабинете уведомлениях MAX отдаёт `null` мгновенно);
  - ошибка (сеть, 429, 5xx, 401) → пауза `1 → 2 → 4 → 8 → 16 → 30 с` (потолок), сброс после
    успешного шага, пауза прерывается `abort`. Упал `delete` → после паузы тот же `receiptId`
    придёт снова, дубль отсекает стор. Ошибки опроса в UI не показываем (минимальный скоуп), цикл
    не падает.
- **UI**: `ChatPage` запускает цикл — он работает, пока открыт экран чатов (есть сессия). Входящее
  попадает в ленту и превью списка через стор, остальной UI не меняется.

## Сценарии использования

1. Собеседник ответил из MAX → ответ появился в открытом чате без перезагрузки.
2. Ответ пришёл в другой чат → виден в превью списка и при переключении.
3. Владелец написал с телефона (приложение MAX) → сообщение в чате как исходящее.
4. Своё сообщение из приложения не дублируется эхом.
5. Событие чата, которого нет в списке, медиа, статус → не показано, очередь не встала.
6. «Выйти» → опрос остановлен.
7. Сеть пропала → пауза, после восстановления ответы снова приходят.

## Критерии приёмки

Данные:

- [x] **К1.** Транспорт: `query` идёт после токена (`…/receiveNotification/test-token?receiveTimeout=20`), `pathSuffix` — сегментом после токена (`…/deleteNotification/test-token/1234567`), без них URL прежний; токена нет в `message` ошибки — `src/api/__tests__/greenApiClient.test.ts`
- [x] **К2.** `receiveNotification` шлёт GET с `query: { receiveTimeout }` и `signal`, `null` пробрасывает; `deleteNotification` — DELETE с `pathSuffix: receiptId` — `src/services/__tests__/notificationService.test.ts`
- [x] **К3.** `parseNotification`: входящее `textMessage` → `incoming`; `outgoingMessageReceived` и `outgoingAPIMessageReceived` → `outgoing`; `extendedTextMessage` → текст из `extendedTextMessageData.text`; числовой `senderData.chatId` → строка; `timestamp` × 1000; медиа, `stateInstanceChanged`, `outgoingMessageStatus`, пустой текст, нет полей, `null`/мусор → `null` без исключения — `src/helpers/__tests__/notification.test.ts`

Цикл:

- [x] **К4.** Порядок `receive → запись в стор → delete(receiptId) → следующий receive`; следующий `receive` не уходит, пока не завершился `delete` — `src/hooks/__tests__/useNotificationPolling.test.tsx`
- [x] **К5.** Удаляется каждое уведомление: чат не из списка (сообщение не показано, чат не создан), нераспознанное (`stateInstanceChanged`, медиа) — там же
- [x] **К6.** Эхо `outgoingAPIMessageReceived` с `idMessage` уже отправленного → в ленте одно сообщение; `outgoingMessageReceived` → исходящее в ленте — там же
- [x] **К7.** Остановка: размонтирование и выход (credentials → `null`) обрывают `signal`, новых `receive` нет, ответ, пришедший после abort, в стор не пишется; в `<StrictMode>` активен ровно один цикл — там же
- [x] **К8.** Ошибка `receive` (сеть, 429) → повтора до паузы нет, пауза растёт по backoff, после успеха сбрасывается; ошибка `delete` → после паузы повтор без дубля в ленте; цикл не падает — там же (fake timers)

UI:

- [x] **К9.** Входящее для открытого чата появляется в ленте `ChatPage` без перезагрузки (сервисы замоканы) — `src/pages/ChatPage/__tests__/ChatPage.test.tsx`
- [x] **К10.** Живой инстанс (Дима): строки 10–10g чек-листа §6 ресёрча; открытые вопросы §2.4 (совпадает ли `senderData.chatId` с `chatId` из `CheckAccount`; приходит ли `outgoingAPIMessageReceived`; путь текста `extendedTextMessage`) — записать в ресёрч §2.4 и skill `green-api` §4/§5 — **проверено Димой 2026-09-29** на инстансе MAX после включения уведомлений в кабинете: 10, 10a, 10b, 10c, 10d, 10f, 10g прошли (10g — ответ через 5–10 с, пауза backoff); 10e отдельно не проверялась, косвенно — 10d. `senderData.chatId` = `chatId` из `CheckAccount` — подтверждено. Приходит ли эхо `outgoingAPIMessageReceived` и путь текста `extendedTextMessage` — не выяснялось (в ленте дублей нет в любом случае), остаются открытыми в §2.4. Заодно 8c из WM-02 — пройдена

Дополнено по ходу (Дима, живой инстанс, 2026-09-29):

- [x] **К11.** Без горячего цикла при «мгновенном» сервере: пустой ответ `receive` → пауза 1 с перед следующим; `deleteNotification` с `result: false` → пауза backoff перед повтором; сервер, отвечающий `null` сразу, получает не больше запроса в секунду — `useNotificationPolling.test.tsx`; вживую — в Network `receiveNotification` не чаще раза в секунду. Причина: на живом инстансе MAX `receiveNotification` с `receiveTimeout=20` отвечал за миллисекунды, и цикл без паузы отправил сотни запросов за пару секунд. Корень — у инстанса были выключены все уведомления; после включения запрос висит 20 с, но пауза остаётся защитой

## Затрагиваемые файлы

- `src/api/greenApiClient.ts`, `src/types/greenApi.ts`, `src/services/notificationService.ts` (новый)
- `src/helpers/notification.ts` (новый), `src/hooks/useNotificationPolling.ts` (новый)
- UI: `src/pages/ChatPage/ChatPage.tsx`; моки сервиса в `ChatPage.test.tsx` и `src/__tests__/App.test.tsx`
- Документы: README («Как пользоваться»), ресёрч §2.4/§5/§5.3/§6, skill `green-api` §2–§5

## Что НЕ входит в скоуп

- Чат по входящему от номера, которого нет в списке.
- Медиа, группы, статусы прочтения, история с сервера, индикатор непрочитанного.
- Сортировка чатов по активности, статус опроса в UI — WM-04.

## Уровень риска

CAUTION — контракт транспорта (URL с токеном), очередь уведомлений: не удалённое уведомление
останавливает приём.
