import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GreenApiError } from '@/api/greenApiClient';
import { AccountNotFoundError, SessionEndedError } from '@/helpers/chatError';
import { useCreateChat } from '@/hooks/useCreateChat';
import { checkAccount, type sendMessage } from '@/services/chatService';
import { CHAT_STORAGE_KEY, useChatStore } from '@/stores/chatStore';
import { useSessionStore } from '@/stores/sessionStore';
import { TEST_CREDENTIALS } from '@/test/fixtures';
import { readPersistedState } from '@/test/persistedState';
import { renderHookWithQueryClient } from '@/test/renderWithQueryClient';
import type { CheckAccountResponse } from '@/types/greenApi';

vi.mock('@/services/chatService', () => ({
  checkAccount: vi.fn<typeof checkAccount>(),
  sendMessage: vi.fn<typeof sendMessage>(),
}));

function renderCreateChat() {
  return renderHookWithQueryClient(() => useCreateChat());
}

// То же, что делает useSignOut, и сразу новый вход тем же инстансом — новый объект учётных данных.
function signOutAndSignInAgain() {
  act(() => {
    useChatStore.getState().reset();
    useSessionStore.getState().signOut();
    useSessionStore.getState().signIn({ ...TEST_CREDENTIALS });
  });
}

beforeEach(() => {
  useChatStore.getState().reset();
  useSessionStore.getState().signIn(TEST_CREDENTIALS);
  sessionStorage.clear();
});

describe('useCreateChat', () => {
  it('exist: true → чат по числовому chatId в сторе и открыт', async () => {
    vi.mocked(checkAccount).mockResolvedValue({ exist: true, chatId: '10000000' });
    const { result } = renderCreateChat();

    act(() => result.current.mutate('79991234567'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(checkAccount).toHaveBeenCalledWith(TEST_CREDENTIALS, 79991234567);
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

  it('ответ CheckAccount после «Выйти» и нового входа в стор не пишется и выход не переживает', async () => {
    let finishCheck!: (response: CheckAccountResponse) => void;
    vi.mocked(checkAccount).mockReturnValue(
      new Promise((resolve) => {
        finishCheck = resolve;
      }),
    );
    const { result } = renderCreateChat();

    act(() => result.current.mutate('79991234567'));
    await waitFor(() => expect(checkAccount).toHaveBeenCalled());
    signOutAndSignInAgain();
    finishCheck({ exist: true, chatId: '10000000' });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(SessionEndedError);
    expect(useChatStore.getState().chats).toEqual([]);
    expect(useChatStore.getState().activeChatId).toBeNull();
    expect(readPersistedState(CHAT_STORAGE_KEY)).toMatchObject({ chats: [], activeChatId: null });
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
