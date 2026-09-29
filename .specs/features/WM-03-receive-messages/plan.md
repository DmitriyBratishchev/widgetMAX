# Plan: Приём сообщений

**Задача**: WM-03
**Ветка**: `feature/WM-03-receive-messages`
**Уровень риска**: CAUTION
**Спек**: `.specs/features/WM-03-receive-messages/spec.md`
**Ресёрч**: `.research/max-chat/research.md` (§5.3, §2.4, §6)

> **Живой документ** — шаги дописываются **накопительно** (отмечать сделанное, не
> переписывать историю плана).

---

## Карта фаз

| Фаза | Цель | Трогает GREEN-API | Критерии | Статус |
|------|------|-------------------|----------|--------|
| **Ф1** | приём сообщений: транспорт, сервис, разбор, цикл, подключение к `ChatPage` | да | К1–К11 | **VERIFIED** (2026-09-29) — К1–К9, К11 тестами, К10 и К11 на живом инстансе |

---

## Ф1 — приём сообщений

### Шаги

1. [x] Транспорт: опции `query` / `pathSuffix` в `src/api/greenApiClient.ts` + тесты (К1).
2. [x] Wire-типы уведомлений в `src/types/greenApi.ts`; `src/services/notificationService.ts` +
   тесты (К2, мок `@/api/greenApiClient`, как в `chatService.test.ts`).
3. [x] `src/helpers/notification.ts` — `parseNotification` + unit (К3, фикстуры по skill
   `green-api` §4, фейковые `chatId: '10000000'`, `idInstance: 1101000000`).
4. [x] `src/hooks/useNotificationPolling.ts` + тесты (К4–К8): `vi.mock('@/services/notificationService')`,
   `renderHook` (+ `StrictMode` для К7), `vi.useFakeTimers()` и `vi.advanceTimersByTimeAsync`
   для пауз; `receive` — управляемые промисы, которые реджектятся `AbortError` по `signal`.
5. [x] `ChatPage.tsx` → `useNotificationPolling()`; моки сервиса в `ChatPage.test.tsx` /
   `App.test.tsx`; тест К9.
6. [x] Документы: README; ресёрч §5.3 (решения), §6 (новые строки 10a–10g); skill `green-api` §2
   (опции транспорта), §3 (цикл в `useNotificationPolling`).

### Ключевые решения

- Цикл — функция внутри хука, стор чатов читается через `getState()` в момент обработки (подписка
  не нужна: цикл не рендерит).
- Guard StrictMode — `abort()` в cleanup эффекта, без модульного флага: повторный mount обрывает
  первый цикл до того, как тот что-то обработает; `receive` из очереди не удаляет.
- `parseNotification` тотальна: исключение на кривом уведомлении не дало бы дойти до `delete`, и
  очередь встала бы.
- Дедуп эха — в сторе (`addMessage` по `idMessage`, с WM-02), разбор эхо не отбрасывает: если эхо
  не придёт или придёт раньше ответа `SendMessage`, лента всё равно без дублей.
- `receiveTimeout = 20` с: запрос висит до 20 с, пока очередь пуста, — нагрузки почти нет, а
  остановка всё равно мгновенная через `abort`.
- Backoff `1 → 2 → 4 → 8 → 16 → 30 с`, сброс после успешного шага. Ошибки опроса в UI не
  показываем — минимальный скоуп; 401 (сменили токен) просто ждёт на потолке паузы.

### Грабли

- Мок `vi.fn()` без реализации мгновенно вернёт `undefined` → горячий цикл в тестах
  `ChatPage`/`App`: мок `receive` должен висеть до abort.
- **Живой инстанс MAX (Дима, 2026-09-29):** `receiveNotification?receiveTimeout=20` вернул пустой
  ответ за миллисекунды — long-poll не держит, и цикл «`null` → сразу следующий `receive`» отправил
  ~360 запросов за пару секунд. Сервер как гарантию паузы не рассматриваем: после `null` — своя
  пауза `EMPTY_QUEUE_PAUSE_MS = 1 с`, `delete` с `result: false` — ошибка с backoff (К11).
  Понимает ли MAX `receiveTimeout` вообще (или в других единицах) — сверить по Timing запроса.
  **Причина найдена** (Дима, 2026-09-29): у инстанса были выключены все уведомления (по умолчанию
  у нового инстанса MAX). После включения входящих и «с телефона» запрос висит `pending` 20 с,
  ответы из MAX приходят в чат. Настройка — в README и skill `green-api` §3; пауза 1 с остаётся.

### Шаги: доработка по живой проверке (2026-09-29)

7. [x] Пауза 1 с после пустого ответа, `result: false` у `delete` → backoff; тесты К11.

### Проверка (DoD)

- **Команда**: `npx vitest run <файлы>` + `npx tsc -p tsconfig.app.json --noEmit` по ходу; в
  `/finish` — `npm run lint` + `npm run format:check` + `npm run build` + `npm run test:run`
- **Ожидаемый результат**: всё зелёное, `tsc` — код 0

---

## Тесты

- [x] Точечно по ходу: `npx vitest run <файл>`, `npx tsc -p tsconfig.app.json --noEmit`
- [x] Полный прогон — **только в `/finish`** (`rules.md` §6):
      `npm run lint` + `npm run format:check` + `npm run build` + `npm run test:run` — зелёные, 2026-09-29 (134 теста)
