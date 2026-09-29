// Поле state из записи persist-middleware Zustand в sessionStorage; нет записи — undefined.
export function readPersistedState(key: string): unknown {
  const parsed: unknown = JSON.parse(sessionStorage.getItem(key) ?? '{}');
  return typeof parsed === 'object' && parsed !== null && 'state' in parsed
    ? parsed.state
    : undefined;
}
