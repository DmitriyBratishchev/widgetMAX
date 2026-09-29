import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GreenApiError } from '@/api/greenApiClient';
import { useSendMessage } from '@/hooks/useSendMessage';
import { type checkAccount, sendMessage } from '@/services/chatService';
import { useChatStore } from '@/stores/chatStore';
import { useSessionStore } from '@/stores/sessionStore';

vi.mock('@/services/chatService', () => ({
  checkAccount: vi.fn<typeof checkAccount>(),
  sendMessage: vi.fn<typeof sendMessage>(),
}));

const credentials = {
  idInstance: '1101000000',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://1101.api.green-api.com',
};

function renderSendMessage() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSendMessage(), { wrapper });
}

beforeEach(() => {
  useChatStore.getState().reset();
  useSessionStore.getState().signIn(credentials);
  sessionStorage.clear();
});

describe('useSendMessage', () => {
  it('ответ idMessage → исходящее сообщение в ленте чата', async () => {
    vi.mocked(sendMessage).mockResolvedValue({ idMessage: 'BAE5F4886F6F2D05' });
    const { result } = renderSendMessage();

    act(() => result.current.mutate({ chatId: '10000000', text: '  Привет  ' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(sendMessage).toHaveBeenCalledWith(credentials, {
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
});
