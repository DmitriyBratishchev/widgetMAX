import { beforeEach, describe, expect, it } from 'vitest';
import { SESSION_STORAGE_KEY, useSessionStore } from '@/stores/sessionStore';

const credentials = {
  idInstance: '1101000000',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://1101.api.green-api.com',
};

beforeEach(() => {
  useSessionStore.getState().signOut();
  sessionStorage.clear();
});

describe('sessionStore', () => {
  it('signIn сохраняет учётные данные в sessionStorage', () => {
    useSessionStore.getState().signIn(credentials);

    expect(useSessionStore.getState().credentials).toEqual(credentials);
    expect(JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) ?? '{}').state).toEqual({
      credentials,
    });
  });

  it('signOut стирает учётные данные', () => {
    useSessionStore.getState().signIn(credentials);
    useSessionStore.getState().signOut();

    expect(useSessionStore.getState().credentials).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) ?? '{}').state).toEqual({
      credentials: null,
    });
  });

  it('rehydrate восстанавливает вход из sessionStorage (F5)', async () => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ state: { credentials }, version: 0 }),
    );

    await useSessionStore.persist.rehydrate();

    expect(useSessionStore.getState().credentials).toEqual(credentials);
  });
});
