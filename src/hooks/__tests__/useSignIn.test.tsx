import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GreenApiError } from '@/api/greenApiClient';
import { useSignIn } from '@/hooks/useSignIn';
import { InstanceNotAuthorizedError } from '@/helpers/signInError';
import { getStateInstance } from '@/services/instanceService';
import { useSessionStore } from '@/stores/sessionStore';
import { TEST_CREDENTIALS } from '@/test/fixtures';
import { renderHookWithQueryClient } from '@/test/renderWithQueryClient';

vi.mock('@/services/instanceService', () => ({
  getStateInstance: vi.fn<typeof getStateInstance>(),
}));

// Как из формы: пробелы вокруг idInstance и слэш в конце apiUrl.
const values = {
  ...TEST_CREDENTIALS,
  idInstance: ` ${TEST_CREDENTIALS.idInstance} `,
  apiUrl: `${TEST_CREDENTIALS.apiUrl}/`,
};

function renderSignIn() {
  return renderHookWithQueryClient(() => useSignIn());
}

beforeEach(() => {
  useSessionStore.getState().signOut();
});

describe('useSignIn', () => {
  it('authorized → нормализованные учётные данные в сессии', async () => {
    vi.mocked(getStateInstance).mockResolvedValue({ stateInstance: 'authorized' });
    const { result } = renderSignIn();

    act(() => result.current.mutate(values));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getStateInstance).toHaveBeenCalledWith(TEST_CREDENTIALS);
    expect(useSessionStore.getState().credentials).toEqual(TEST_CREDENTIALS);
  });

  it('инстанс не авторизован → ошибка в мутации, сессии нет', async () => {
    vi.mocked(getStateInstance).mockResolvedValue({ stateInstance: 'notAuthorized' });
    const { result } = renderSignIn();

    act(() => result.current.mutate(values));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(InstanceNotAuthorizedError);
    expect(useSessionStore.getState().credentials).toBeNull();
  });

  it('ошибка API → ошибка в мутации, сессии нет', async () => {
    vi.mocked(getStateInstance).mockRejectedValue(
      new GreenApiError('getStateInstance', 'http', 401),
    );
    const { result } = renderSignIn();

    act(() => result.current.mutate(values));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({ status: 401 });
    expect(useSessionStore.getState().credentials).toBeNull();
  });
});
