import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GreenApiError } from '@/api/greenApiClient';
import { SessionEndedError } from '@/helpers/chatError';
import { useSendMessage } from '@/hooks/useSendMessage';
import { type checkAccount, sendMessage } from '@/services/chatService';
import { CHAT_STORAGE_KEY, useChatStore } from '@/stores/chatStore';
import { useSessionStore } from '@/stores/sessionStore';
import { TEST_CREDENTIALS } from '@/test/fixtures';
import { readPersistedState } from '@/test/persistedState';
import { renderHookWithQueryClient } from '@/test/renderWithQueryClient';
import type { SendMessageResponse } from '@/types/greenApi';

vi.mock('@/services/chatService', () => ({
  checkAccount: vi.fn<typeof checkAccount>(),
  sendMessage: vi.fn<typeof sendMessage>(),
}));

function renderSendMessage() {
  return renderHookWithQueryClient(() => useSendMessage());
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

describe('useSendMessage', () => {
  it('ответ idMessage → исходящее сообщение в ленте чата', async () => {
    vi.mocked(sendMessage).mockResolvedValue({ idMessage: 'BAE5F4886F6F2D05' });
    const { result } = renderSendMessage();

    act(() => result.current.mutate({ chatId: '10000000', text: '  Привет  ' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(sendMessage).toHaveBeenCalledWith(TEST_CREDENTIALS, {
      chatId: '10000000',
      message: 'Привет',
    });
    expect(useChatStore.getState().messagesByChatId['10000000']).toEqual([
      expect.objectContaining({
        idMessage: 'BAE5F4886F6F2D05',
        text: 'Привет',
        direction: 'outgoing',
      }),
    ]);
  });

  it('ошибка отправки → в ленте ничего', async () => {
    vi.mocked(sendMessage).mockRejectedValue(new GreenApiError('sendMessage', 'http', 400));
    const { result } = renderSendMessage();

    act(() => result.current.mutate({ chatId: '10000000', text: 'Привет' }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(useChatStore.getState().messagesByChatId).toEqual({});
  });

  it('ответ SendMessage после «Выйти» и нового входа в журнал не пишется', async () => {
    let finishSend!: (response: SendMessageResponse) => void;
    vi.mocked(sendMessage).mockReturnValue(
      new Promise((resolve) => {
        finishSend = resolve;
      }),
    );
    const { result } = renderSendMessage();

    act(() => result.current.mutate({ chatId: '10000000', text: 'Привет' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalled());
    signOutAndSignInAgain();
    finishSend({ idMessage: 'BAE5F4886F6F2D05' });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(SessionEndedError);
    expect(useChatStore.getState().messagesByChatId).toEqual({});
    expect(readPersistedState(CHAT_STORAGE_KEY)).toMatchObject({ messagesByChatId: {} });
  });
});
