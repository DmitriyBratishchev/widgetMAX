# Plan: Вход и сессия

**Задача**: WM-01
**Ветка**: `feature/WM-01-login`
**Уровень риска**: CAUTION
**Спек**: `.specs/features/WM-01-login/spec.md`
**Ресёрч**: `.research/max-chat/research.md` (§5.1, §2.1–2.3, §3 Р1–Р3)

> **Живой документ** — шаги дописываются **накопительно** (отмечать сделанное, не
> переписывать историю плана).

---

## Карта фаз

| Фаза | Цель | Трогает GREEN-API | Критерии | Коммит | Статус |
|------|------|-------------------|----------|--------|--------|
| **Ф1** | вход целиком: транспорт, сессия, хук, форма входа, выбор экрана | да | К1–К14 | единственный коммит ветки | **VERIFIED** (2026-09-29) — К1–К13; К14 ждёт Диму |

**Одна фаза — решение Димы (2026-09-29):** задачи эпика небольшие, дробление на фазы (пакет
передачи, прогон на каждую фазу) дороже пользы. Задача начиналась двумя фазами; слой данных уже
был закоммичен отдельно, UI дописывается в тот же коммит через `--amend` — в `dev` уходит один
коммит задачи.

---

## Ф1 — вход и сессия

### Шаги: данные — сделано

1. [x] `src/types/greenApi.ts` — `GreenApiCredentials`, `StateInstance` (статусы из skill
   `green-api` §2), `GetStateInstanceResponse`.
2. [x] `src/api/greenApiClient.ts` — `GreenApiError` (`kind: 'http' | 'network'`, `status?`; поля
   явные — `erasableSyntaxOnly` запрещает parameter properties) и
   `greenApiRequest<T>(credentials, method, { httpMethod, body, signal })`: `!ok` → ошибка по
   статусу без чтения тела; успех → `text ? JSON.parse(text) : null`; `TypeError` от `fetch` →
   `network`; `AbortError` — как есть; в `message` только метод и статус.
3. [x] `src/services/instanceService.ts` — `getStateInstance(credentials)`.
4. [x] `src/helpers/apiUrl.ts` — `suggestApiUrl`, `normalizeApiUrl`;
   `src/helpers/credentialsValidation.ts` — `validateCredentials`, `normalizeCredentials`;
   `src/helpers/signInError.ts` — `InstanceNotAuthorizedError`, `getSignInErrorMessage`.
5. [x] `src/stores/sessionStore.ts` — Zustand + `persist(createJSONStorage(() => sessionStorage))`,
   ключ `widgetmax-session`, `partialize` → только `credentials`; `signIn`, `signOut`.
6. [x] `src/hooks/useSignIn.ts` — `useMutation`: нормализовать → `getStateInstance` → не
   `authorized` → `throw InstanceNotAuthorizedError`; `onSuccess` → `signIn`.
7. [x] Тесты в `__tests__/` рядом с кодом. Сервис мокается `vi.mock`; `fetch` подменяет только
   тест самого транспорта (ниже транспорта мокать нечего). 30 тестов зелёные.

### Шаги: UI — сделано

8. [x] `src/styles/tokens/` — недостающие токены: тень карточки, прозрачность `disabled`, толщина
   рамки и фокуса, высота контрола, ширина формы входа, высота шапки (литералы вне токенов
   запрещены, `rules.md` §8).
9. [x] `src/components/ui/Button/` — `variant: 'primary' | 'secondary'`, остальное — атрибуты
   `<button>`.
10. [x] `src/components/ui/Input/` — `label`, `error?` + атрибуты `<input>`; `useId` связывает label,
    поле и текст ошибки (`aria-invalid`, `aria-describedby`).
11. [x] `src/pages/LoginPage/` — форма `noValidate`: значения в `useState`; пока `apiUrl` не правили
    руками, он пересчитывается из `idInstance` через `suggestApiUrl`; на submit —
    `validateCredentials` → ошибки полей или `signIn.mutate`; правка поля снимает его ошибку;
    «Войти» `disabled` при `isPending`; `getSignInErrorMessage(signIn.error)` в `role="alert"`.
12. [x] `src/pages/ChatPage/` — оболочка: шапка с `idInstance` и «Выйти» (`signOut` из стора),
    заглушка области чатов до WM-02.
13. [x] `src/App.tsx` — `useSessionStore((s) => s.credentials !== null)` → `ChatPage` / `LoginPage`;
    `App.module.scss` заглушки каркаса удалить.
14. [x] Тесты: `src/test/renderWithQueryClient.tsx` (общая обёртка);
    `src/pages/LoginPage/__tests__/LoginPage.test.tsx` (К9–К11, сервис замокан);
    `src/__tests__/App.test.tsx` (К12).
15. [x] Headless-скриншот `npm run dev`: пустая форма и ошибка 401 на фейковых данных (К13).

### Ключевые решения

- Ошибку «инстанс не авторизован» бросает хук, а не сервис и не компонент: любой отказ входа
  приходит одним путём — `mutation.error` — и UI показывает его через `getSignInErrorMessage`,
  не разбирая `data`.
- Кит `components/ui` не знает о домене: `Input` получает готовый текст ошибки, а `LoginPage`
  сама решает, когда его показать. Так кит переиспользуется в WM-02 без правок.

### Грабли

- `erasableSyntaxOnly` в `tsconfig.app.json` запрещает parameter properties и `enum`.
- Тесты, трогающие стор, сбрасывают его (`signOut()` + `sessionStorage.clear()` в `beforeEach`),
  иначе состояние протекает между тестами.
- Правило `/finish` «вписать sha тем же коммитом через `--amend`» невыполнимо — `--amend` меняет
  sha. Поправить команду после задачи.

### Проверка (DoD)

- **Команда**: `npx vitest run` + `npx tsc -p tsconfig.app.json --noEmit` + скриншот `npm run dev`
- **Ожидаемый результат**: тесты зелёные, `tsc` — код 0, на скриншоте форма входа и текст
  ошибки 401

---

## Тесты

- [x] Точечно по ходу: `npx vitest run <файл>`, `npx tsc -p tsconfig.app.json --noEmit`
- [x] Полный прогон — **только в `/finish`** (`rules.md` §6):
      `npm run lint` + `npm run format:check` + `npm run build` + `npm run test:run` — зелёные, 2026-09-29 (36 тестов)
