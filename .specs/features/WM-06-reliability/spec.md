# Надёжность

**Статус**: ЗАВЕРШЕНО
**Задача**: WM-06
**Дата**: 2026-09-29
**Масштаб**: среднее
**Ресёрч**: `.research/code-quality/research.md` — §3.1 (находки), §6 Р2 (401 в опросе), §7, §8 строки 3–5

> **Живой документ** — дополняется по ходу выполнения (критерии/скоуп/статус). Если фаза
> выявила изменение задачи или эпика — правку внести здесь и/или в ресёрч (`rules.md` §3).
>
> **Статусы**: ЧЕРНОВИК → УТВЕРЖДЕНО → В РАБОТЕ → ЗАВЕРШЕНО. В `ЗАВЕРШЕНО` переводим
> только на **последней** фазе задачи, когда все критерии `[x]`.

---

## Проблема

Дефекты поведения из §3.1 ресёрча. Каждое место перепроверено по коду `dev` после WM-05 —
подтвердились все пять:

- `useCreateChat.ts`, `useSendMessage.ts` — `onSuccess: addChat/addMessage` без проверки сессии:
  ответ, пришедший после «Выйти», пишет в уже сброшенный стор, и чат переживает выход в
  `sessionStorage`.
- `useNotificationPolling.ts` — `catch {}` не различает ошибки: на отозванном токене (401/403)
  цикл бесконечно повторяет запросы с паузой до 30 с, в UI ничего; `TypeError` из кода — тоже молча.
- `greenApiClient.ts` — `(text ? JSON.parse(text) : null) as T`: пустое тело на 200 даёт `null`
  под типом `T`, битый JSON — сырой `SyntaxError` вместо `GreenApiError`; у `fetch` нет таймаута —
  зависшая сеть держит `isPending` бесконечно.
- `notification.ts` — `DIRECTION_BY_WEBHOOK[typeWebhook]` ищет и по прототипу (`'toString'` →
  функция как направление).
- `MessageComposer.tsx` — поле не заблокировано во время отправки, `onSuccess: () => setText('')`
  стирает допечатанное.

## Решение

Решения Димы (AskUserQuestion, 2026-09-29): поле — `readOnly` на время отправки; неожиданная
ошибка в опросе — остановка и своя плашка; приведение `as T` в транспорте — оставить с актуальной
причиной, валидаторы формы ответа по методам не делаем.

1. **Гонка выхода — сверка сессии после ответа.** В `mutationFn` после `await` сервиса:
   `if (!isCurrentSession(credentials)) throw new SessionEndedError()`. `isCurrentSession` — в
   `sessionStore.ts`: `useSessionStore.getState().credentials === credentials`. Сравнение по
   ссылке: «Выйти» ставит `null`, каждый вход — новый объект из `normalizeCredentials`, так что
   «вышел и тут же вошёл тем же инстансом» тоже отсекается. `SessionEndedError` — в
   `helpers/chatError.ts` рядом с `AccountNotFoundError`. `onSuccess` (запись в стор, очистка поля
   в компоненте) при этом не вызывается; ошибку никто не видит — экран чатов уже размонтирован.
   - *Почему не отмена запроса:* у `useMutation` нет отмены — пришлось бы тянуть `AbortSignal`
     через сервисы и держать реестр контроллеров, а `SendMessage` на сервере отменой всё равно не
     откатить. Сверка — строка на хук и покрывает оба случая.
   - *Почему не проверка в `onSuccess`:* TanStack обновляет опции текущей мутации при каждом
     рендере, и `onSuccess` видит `credentials` последнего рендера, а не момента запуска;
     `mutationFn` берётся в момент запуска.
2. **Опрос: разбор ошибок и остановка** (Р2 — пересмотр решения WM-03 «ошибки опроса в UI не
   показываем»). В `catch` цикла:
   - `GreenApiError` `http` 401/403 → цикл **останавливается**, причина `'credentials-rejected'`;
   - прочие `GreenApiError` (сеть, таймаут, 429, 5xx, некорректный ответ) и `result: false` у
     `DeleteNotification` → как раньше, молча: пауза `RETRY_DELAYS_MS` → `MAX_RETRY_DELAY_MS`;
   - всё остальное (ошибка в коде) → остановка, причина `'unexpected-error'`, в dev-режиме — ещё
     `console.error` (токена там нет: ошибки транспорта сюда не попадают). Повторять баг каждые
     30 с бессмысленно, а так он виден.

   **Признак остановки — возвращаемое значение хука** `useNotificationPolling(): PollingStopReason | null`:
   `useState` внутри хука, привязанный к объекту `credentials` (новая сессия → `null` без сброса
   в эффекте). *Почему не стор:* это состояние живого цикла, а не данные сессии или журнала;
   единственный потребитель — `ChatPage`, который и владеет жизнью цикла; после F5 цикл
   перезапускается и получит 401 снова — персистить нечего. Контракт `frontend-patterns` соблюдён:
   цикл — в `hooks/`, JSX — в `pages/`.

   **Плашка** — в `ChatPage`, вверху колонки чата (под шапкой чата или над заглушкой «Выберите
   чат»), `role="alert"`:
   - `'credentials-rejected'` → «Приём сообщений остановлен: GREEN-API не принял учётные данные.
     Войдите заново»;
   - `'unexpected-error'` → «Приём сообщений остановлен из-за ошибки приложения. Обновите страницу».
3. **Транспорт** `greenApiClient.ts`:
   - новый вид ошибки `kind: 'response'` (некорректный ответ): битый JSON; пустое тело или JSON
     `null` у метода, который его не допускает. Тексты ошибок в UI для него — общие «Не удалось…»;
   - опция `nullable` — пустое тело или `null` → `null`. Только у `receiveNotification`
     («очередь пуста»), тип сервиса и так `… | null`;
   - таймаут: опция `timeoutMs`, по умолчанию `REQUEST_TIMEOUT_MS = 30_000`. Свой
     `AbortController` + `setTimeout`, отмена вызывающего пробрасывается в него; таймер живёт до
     конца чтения тела и снимается в `finally`. Сработал таймаут → `GreenApiError` `kind: 'network'`:
     для пользователя и для цикла это та же недоступная сеть — тексты ошибок и backoff не меняются.
     Отмена вызывающим → `AbortError`, как раньше. `receiveNotification` передаёт
     `timeoutMs: (receiveTimeout + 10) * 1000` — long-poll плюс 10 с запаса.
     *Почему не `AbortSignal.timeout`/`AbortSignal.any`:* ручной таймер работает с fake timers
     Vitest и не зависит от поддержки `AbortSignal.any` в jsdom и старых Safari;
   - отключение `typescript/no-unsafe-type-assertion` **остаётся** с актуальной причиной: тело
     проверено на JSON и непустоту, форма ответа методов с фиксированным контрактом не валидируется;
     изменчивые данные (тело уведомления) защитно разбирает `parseNotification`.
4. **`notification.ts`** — таблица `DIRECTION_BY_WEBHOOK` → функция со `switch` по `typeWebhook`:
   прототип не участвует.
5. **`MessageComposer`** — `readOnly={send.isPending}` у поля. Не `disabled`: фокус остаётся в поле,
   после ответа можно печатать дальше. Очистка — по-прежнему только после успеха.

## Сценарии использования

1. Токен отозван → опрос встал, над лентой плашка, `receiveNotification` больше не уходят.
2. «Создать чат» → сразу «Выйти» → войти снова → список пуст.
3. Идёт отправка → поле не редактируется; ответ пришёл → поле пусто, фокус в поле.
4. Сеть пропала / 429 → молча, с паузами (как было).
5. Сеть зависла → обычный запрос обрывается через 30 с, `receiveNotification` — через 30 с
   (20 с long-poll + 10 с запаса): ошибка сети, `isPending` не висит вечно.

## Критерии приёмки

- [x] **К1.** `useCreateChat`: `checkAccount` висит → выход → вход заново → ответ пришёл: `chats` пусто в сторе и в `sessionStorage`, мутация — `SessionEndedError` — `npx vitest run src/hooks/__tests__/useCreateChat.test.tsx`
- [x] **К2.** `useSendMessage`: то же для `sendMessage` — `messagesByChatId` пуст в сторе и в `sessionStorage` — `src/hooks/__tests__/useSendMessage.test.tsx`
- [x] **К3.** Опрос: 401 и 403 от `receive` → хук возвращает `'credentials-rejected'`, за 60 с fake timers новых `receive` нет, таймеров не осталось — `src/hooks/__tests__/useNotificationPolling.test.tsx`
- [x] **К4.** Опрос: не-`GreenApiError` (`TypeError`) → `'unexpected-error'`, цикл встал; новая сессия (другой объект `credentials`) → `null`, цикл снова идёт — там же
- [x] **К5.** Опрос: сеть, 429, 500, `result: false` — backoff как раньше, причина `null` — там же
- [x] **К6.** `ChatPage`: 401 в опросе → `role="alert"` с текстом Р2; без ошибок плашки нет — `src/pages/ChatPage/__tests__/ChatPage.test.tsx`
- [x] **К7.** Транспорт: пустое тело и `null` без `nullable` → `GreenApiError` `kind: 'response'`; с `nullable` → `null`; битый JSON → `kind: 'response'`, токена в тексте нет — `src/api/__tests__/greenApiClient.test.ts`
- [x] **К8.** Транспорт: зависший `fetch` → через `REQUEST_TIMEOUT_MS` `GreenApiError` `kind: 'network'`, запрос оборван; `timeoutMs` переопределяется; после ответа таймеров не осталось; отмена вызывающим — `AbortError` как есть — там же
- [x] **К9.** `receiveNotification` передаёт `nullable: true` и `timeoutMs` больше `receiveTimeout` — `src/services/__tests__/notificationService.test.ts`
- [x] **К10.** Отключение `no-unsafe-type-assertion` в транспорте пересмотрено: оставлено с актуальной причиной — `grep -n "eslint-disable" src/api/greenApiClient.ts` + `npm run lint`
- [x] **К11.** `parseNotification`: `typeWebhook` `toString`, `constructor`, `__proto__`, `hasOwnProperty` → `null` — `src/helpers/__tests__/notification.test.ts`
- [x] **К12.** `MessageComposer`: во время отправки поле `readOnly`, набор не меняет значение; после успеха поле пусто и в фокусе; после ошибки текст на месте — `ChatPage.test.tsx`
- [x] **К13.** `npm run lint`, `npm run format:check`, `npm run build`, `npm run test:run -- --maxWorkers=2` — зелёные (`/finish`, 2026-09-29: lint и format чистые, сборка прошла, 19 файлов / 164 теста)
- [x] **К14.** Вживую (Дима): строки 3–5 §8 ресёрча `code-quality` + регресс `.research/max-chat/research.md` §6 — строки 3–5 **проверены Димой 2026-09-29** (строка 3 — сменой `apiTokenInstance` в кабинете, плашка появилась); регресс `max-chat` §6 (1, 5, 6, 8, 10, 10f, 10g) — **пройден Димой 2026-09-29** (отмечено после слияния, `chore/wm-06-verified`)

## Затрагиваемые файлы

- `src/api/greenApiClient.ts`, `src/services/notificationService.ts`
- `src/helpers/notification.ts`, `src/helpers/chatError.ts`, `src/stores/sessionStore.ts`
- `src/hooks/useCreateChat.ts`, `src/hooks/useSendMessage.ts`, `src/hooks/useNotificationPolling.ts`
- `src/pages/ChatPage/ChatPage.tsx` (+ `.module.scss`), `src/pages/ChatPage/MessageComposer/MessageComposer.tsx`
- тесты рядом с каждым; документы — ресёрчи `max-chat` §5.3–5.4 и `code-quality` §3.4/§7/§8,
  skills `green-api` §2–§3 и `frontend-patterns` §«Состояние»

## Что НЕ входит в скоуп

- Контраст и фокус (WM-07); дубли текстов ошибок, `cx()`, фикстуры, `flush()` → `vi.waitFor` (WM-08).
- Валидаторы формы ответа по методам (решение Димы).
- Плашка на узком экране в режиме списка: колонка чата там скрыта, плашка видна при открытии чата.

## Уровень риска

CAUTION — транспорт (URL с токеном, таймаут), цикл опроса очереди, сессия.
