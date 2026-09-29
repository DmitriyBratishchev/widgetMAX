import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GreenApiError } from '@/api/greenApiClient';
import { useSignIn } from '@/hooks/useSignIn';
import { InstanceNotAuthorizedError } from '@/helpers/signInError';
import { getStateInstance } from '@/services/instanceService';
import { useSessionStore } from '@/stores/sessionStore';

vi.mock('@/services/instanceService', () => ({ getStateInstance: vi.fn() }));

const values = {
  idInstance: ' 1101000000 ',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://1101.api.green-api.com/',
};

function renderSignIn() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSignIn(), { wrapper });
}

beforeEach(() => {
  vi.mocked(getStateInstance).mockReset();
  useSessionStore.getState().signOut();
});

describe('useSignIn', () => {
  it('authorized → нормализованные учётные данные в сессии', async () => {
    vi.mocked(getStateInstance).mockResolvedValue({ stateInstance: 'authorized' });
    const { result } = renderSignIn();

    act(() => result.current.mutate(values));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const expected = {
      idInstance: '1101000000',
      apiTokenInstance: 'test-token',
      apiUrl: 'https://1101.api.green-api.com',
    };
    expect(getStateInstance).toHaveBeenCalledWith(expected);
    expect(useSessionStore.getState().credentials).toEqual(expected);
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
