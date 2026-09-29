import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GreenApiError } from '@/api/greenApiClient';
import { AccountNotFoundError } from '@/helpers/chatError';
import { useCreateChat } from '@/hooks/useCreateChat';
import { checkAccount } from '@/services/chatService';
import { useChatStore } from '@/stores/chatStore';
import { useSessionStore } from '@/stores/sessionStore';

vi.mock('@/services/chatService', () => ({ checkAccount: vi.fn(), sendMessage: vi.fn() }));

const credentials = {
  idInstance: '1101000000',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://1101.api.green-api.com',
};

function renderCreateChat() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCreateChat(), { wrapper });
}

beforeEach(() => {
  vi.mocked(checkAccount).mockReset();
  useChatStore.getState().reset();
  useSessionStore.getState().signIn(credentials);
  sessionStorage.clear();
});

describe('useCreateChat', () => {
  it('exist: true → чат по числовому chatId в сторе и открыт', async () => {
    vi.mocked(checkAccount).mockResolvedValue({ exist: true, chatId: '10000000' });
    const { result } = renderCreateChat();

    act(() => result.current.mutate('79991234567'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(checkAccount).toHaveBeenCalledWith(credentials, 79991234567);
    expect(useChatStore.getState().chats).toEqual([{ chatId: '10000000', phone: '79991234567' }]);
    expect(useChatStore.getState().activeChatId).toBe('10000000');
  });

  it('exist: false → AccountNotFoundError, чат не создан', async () => {
    vi.mocked(checkAccount).mockResolvedValue({ exist: false, chatId: '' });
    const { result } = renderCreateChat();

    act(() => result.current.mutate('79991234567'));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(AccountNotFoundError);
    expect(useChatStore.getState().chats).toEqual([]);
  });

  it('ошибка API → ошибка в мутации, чат не создан', async () => {
    vi.mocked(checkAccount).mockRejectedValue(new GreenApiError('checkAccount', 'http', 469));
    const { result } = renderCreateChat();

    act(() => result.current.mutate('79991234567'));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({ status: 469 });
    expect(useChatStore.getState().chats).toEqual([]);
  });

  it('номер уже в списке → CheckAccount не тратится, чат открывается', async () => {
    useChatStore.getState().addChat({ chatId: '10000000', phone: '79991234567' });
    useChatStore.getState().addChat({ chatId: '20000000', phone: '79990000000' });
    const { result } = renderCreateChat();

    act(() => result.current.mutate('79991234567'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(checkAccount).not.toHaveBeenCalled();
    expect(useChatStore.getState().chats).toHaveLength(2);
    expect(useChatStore.getState().activeChatId).toBe('10000000');
  });
});
