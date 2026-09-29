import { beforeEach, describe, expect, it } from 'vitest';
import { SESSION_STORAGE_KEY, useSessionStore } from '@/stores/sessionStore';
import { TEST_CREDENTIALS } from '@/test/fixtures';
import { readPersistedState } from '@/test/persistedState';

beforeEach(() => {
  useSessionStore.getState().signOut();
  sessionStorage.clear();
});

describe('sessionStore', () => {
  it('signIn сохраняет учётные данные в sessionStorage', () => {
    useSessionStore.getState().signIn(TEST_CREDENTIALS);

    expect(useSessionStore.getState().credentials).toEqual(TEST_CREDENTIALS);
    expect(readPersistedState(SESSION_STORAGE_KEY)).toEqual({
      credentials: TEST_CREDENTIALS,
    });
  });

  it('signOut стирает учётные данные', () => {
    useSessionStore.getState().signIn(TEST_CREDENTIALS);
    useSessionStore.getState().signOut();

    expect(useSessionStore.getState().credentials).toBeNull();
    expect(readPersistedState(SESSION_STORAGE_KEY)).toEqual({
      credentials: null,
    });
  });

  it('rehydrate восстанавливает вход из sessionStorage (F5)', async () => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ state: { credentials: TEST_CREDENTIALS }, version: 0 }),
    );

    await useSessionStore.persist.rehydrate();

    expect(useSessionStore.getState().credentials).toEqual(TEST_CREDENTIALS);
  });
});
