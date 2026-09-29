import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GreenApiError } from '@/api/greenApiClient';
import { useNotificationPolling } from '@/hooks/useNotificationPolling';
import { deleteNotification, receiveNotification } from '@/services/notificationService';
import { useChatStore } from '@/stores/chatStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { ReceiveNotificationResponse } from '@/types/greenApi';

vi.mock('@/services/notificationService', () => ({
  receiveNotification: vi.fn<typeof receiveNotification>(),
  deleteNotification: vi.fn<typeof deleteNotification>(),
}));

const credentials = {
  idInstance: '1101000000',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://1101.api.green-api.com',
};

interface PendingReceive {
  resolve: (notification: ReceiveNotificationResponse | null) => void;
  signal: AbortSignal;
}

// Каждый receive висит, пока тест его не завершит (как long-poll), и обрывается по abort.
// Мок, мгновенно отдающий null, крутил бы цикл без пауз.
let receives: PendingReceive[] = [];

function hangingReceive(rejectOnAbort: boolean) {
  return (_credentials: unknown, _timeout: number, signal?: AbortSignal) =>
    new Promise<ReceiveNotificationResponse | null>((resolve, reject) => {
      receives.push({ resolve, signal: signal! });
      if (rejectOnAbort) {
        signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')), {
          once: true,
        });
      }
    });
}

function textNotification(
  receiptId: number,
  {
    typeWebhook = 'incomingMessageReceived',
    chatId = '10000000',
    idMessage = `id-${receiptId}`,
  } = {},
): ReceiveNotificationResponse {
  return {
    receiptId,
    body: {
      typeWebhook,
      timestamp: 1763115112,
      idMessage,
      senderData: { chatId },
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет!' } },
    },
  };
}

function lastReceive() {
  const last = receives.at(-1);
  if (!last) throw new Error('receiveNotification ещё не вызывался');
  return last;
}

// У всех запросов одного цикла общий signal: живой signal = живой цикл.
function liveLoops() {
  return new Set(receives.map((r) => r.signal).filter((s) => !s.aborted)).size;
}

function StrictModeWrapper({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}

// Цикл — цепочка промисов: даём ей пройти несколько шагов.
async function flush() {
  await act(async () => {
    // eslint-disable-next-line eslint/no-await-in-loop -- каждый await — отдельный микротакт
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });
}

async function answer(notification: ReceiveNotificationResponse | null) {
  lastReceive().resolve(notification);
  await flush();
}

function messages() {
  return useChatStore.getState().messagesByChatId['10000000'] ?? [];
}

beforeEach(() => {
  receives = [];
  vi.mocked(receiveNotification).mockImplementation(hangingReceive(true));
  vi.mocked(deleteNotification).mockResolvedValue({ result: true });
  useChatStore.getState().reset();
  useChatStore.getState().addChat({ chatId: '10000000', phone: '79991234567' });
  useSessionStore.getState().signIn(credentials);
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useNotificationPolling: порядок', () => {
  it('receive → запись в стор → delete(receiptId) → следующий receive только после delete', async () => {
    let finishDelete!: () => void;
    let messagesAtDelete = -1;
    vi.mocked(deleteNotification).mockImplementation(() => {
      messagesAtDelete = messages().length;
      return new Promise((resolve) => {
        finishDelete = () => resolve({ result: true });
      });
    });
    renderHook(() => useNotificationPolling());

    expect(receiveNotification).toHaveBeenCalledTimes(1);
    expect(receiveNotification).toHaveBeenCalledWith(credentials, 20, expect.any(AbortSignal));

    await answer(textNotification(1));

    expect(messagesAtDelete).toBe(1);
    expect(deleteNotification).toHaveBeenCalledWith(credentials, 1, expect.any(AbortSignal));
    expect(receiveNotification).toHaveBeenCalledTimes(1);

    finishDelete();
    await flush();

    expect(receiveNotification).toHaveBeenCalledTimes(2);
    const calls = [
      ...vi
        .mocked(receiveNotification)
        .mock.invocationCallOrder.map((order) => ({ order, name: 'receive' })),
      ...vi
        .mocked(deleteNotification)
        .mock.invocationCallOrder.map((order) => ({ order, name: 'delete' })),
    ];
    expect(calls.toSorted((a, b) => a.order - b.order).map((call) => call.name)).toEqual([
      'receive',
      'delete',
      'receive',
    ]);
    expect(messages()).toEqual([
      expect.objectContaining({ idMessage: 'id-1', text: 'Привет!', direction: 'incoming' }),
    ]);
  });

  it('пустая очередь (null) → без delete, следующий receive через 1 с, а не сразу', async () => {
    vi.useFakeTimers();
    renderHook(() => useNotificationPolling());

    await answer(null);

    expect(deleteNotification).not.toHaveBeenCalled();
    expect(receiveNotification).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(999));
    expect(receiveNotification).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    await flush();
    expect(receiveNotification).toHaveBeenCalledTimes(2);
  });

  it('сервер мгновенно отвечает null (как MAX вживую) → не больше запроса в секунду', async () => {
    vi.useFakeTimers();
    vi.mocked(receiveNotification).mockResolvedValue(null);
    renderHook(() => useNotificationPolling());

    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(vi.mocked(receiveNotification).mock.calls.length).toBeLessThanOrEqual(11);
  });
});

describe('useNotificationPolling: удаление каждого уведомления', () => {
  it('сообщение чата, которого нет в списке, удаляется без показа и без нового чата', async () => {
    renderHook(() => useNotificationPolling());

    await answer(textNotification(1, { chatId: '20000000' }));

    expect(deleteNotification).toHaveBeenCalledWith(credentials, 1, expect.any(AbortSignal));
    expect(useChatStore.getState().messagesByChatId).toEqual({});
    expect(useChatStore.getState().chats.map((c) => c.chatId)).toEqual(['10000000']);
    expect(receiveNotification).toHaveBeenCalledTimes(2);
  });

  it('нераспознанные уведомления (состояние, медиа) удаляются, цикл идёт дальше', async () => {
    renderHook(() => useNotificationPolling());

    await answer({ receiptId: 1, body: { typeWebhook: 'stateInstanceChanged' } });
    await answer({
      receiptId: 2,
      body: {
        ...textNotification(2).body,
        messageData: { typeMessage: 'imageMessage' },
      },
    });

    expect(vi.mocked(deleteNotification).mock.calls.map(([, receiptId]) => receiptId)).toEqual([
      1, 2,
    ]);
    expect(useChatStore.getState().messagesByChatId).toEqual({});
    expect(receiveNotification).toHaveBeenCalledTimes(3);
  });
});

describe('useNotificationPolling: исходящие', () => {
  it('эхо outgoingAPIMessageReceived уже отправленного сообщения не дублирует его', async () => {
    useChatStore.getState().addMessage({
      idMessage: 'BAE5F4886F6F2D05',
      chatId: '10000000',
      text: 'Привет!',
      direction: 'outgoing',
      timestamp: 1763115112000,
    });
    renderHook(() => useNotificationPolling());

    await answer(
      textNotification(1, {
        typeWebhook: 'outgoingAPIMessageReceived',
        idMessage: 'BAE5F4886F6F2D05',
      }),
    );

    expect(messages()).toHaveLength(1);
    expect(deleteNotification).toHaveBeenCalledWith(credentials, 1, expect.any(AbortSignal));
  });

  it('outgoingMessageReceived (с телефона владельца) → исходящее в ленте', async () => {
    renderHook(() => useNotificationPolling());

    await answer(textNotification(1, { typeWebhook: 'outgoingMessageReceived' }));

    expect(messages()).toEqual([
      expect.objectContaining({ idMessage: 'id-1', direction: 'outgoing' }),
    ]);
  });
});

describe('useNotificationPolling: остановка', () => {
  it('размонтирование обрывает receive, новых запросов нет', async () => {
    const { unmount } = renderHook(() => useNotificationPolling());
    const { signal } = lastReceive();

    unmount();
    await flush();

    expect(signal.aborted).toBe(true);
    expect(receiveNotification).toHaveBeenCalledTimes(1);
  });

  it('выход из сессии обрывает цикл', async () => {
    renderHook(() => useNotificationPolling());
    const { signal } = lastReceive();

    act(() => useSessionStore.getState().signOut());
    await flush();

    expect(signal.aborted).toBe(true);
    expect(receiveNotification).toHaveBeenCalledTimes(1);
  });

  it('ответ, пришедший после abort, в стор не пишется и не удаляется', async () => {
    vi.mocked(receiveNotification).mockImplementation(hangingReceive(false));
    const { unmount } = renderHook(() => useNotificationPolling());

    unmount();
    await answer(textNotification(1));

    expect(messages()).toEqual([]);
    expect(deleteNotification).not.toHaveBeenCalled();
    expect(receiveNotification).toHaveBeenCalledTimes(1);
  });

  it('в StrictMode активен ровно один цикл', async () => {
    renderHook(() => useNotificationPolling(), { wrapper: StrictModeWrapper });
    await flush();

    expect(liveLoops()).toBe(1);

    await answer(textNotification(1));

    expect(messages()).toHaveLength(1);
    expect(deleteNotification).toHaveBeenCalledTimes(1);
    expect(liveLoops()).toBe(1);
  });
});

describe('useNotificationPolling: ошибки', () => {
  it('ошибка receive → пауза с растущим backoff, после успеха пауза сбрасывается', async () => {
    vi.useFakeTimers();
    vi.mocked(receiveNotification)
      .mockRejectedValueOnce(new GreenApiError('receiveNotification', 'network'))
      .mockRejectedValueOnce(new GreenApiError('receiveNotification', 'http', 429));
    renderHook(() => useNotificationPolling());
    await flush();
    expect(receiveNotification).toHaveBeenCalledTimes(1);

    // Первая пауза — 1 с.
    await act(() => vi.advanceTimersByTimeAsync(999));
    expect(receiveNotification).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    await flush();
    expect(receiveNotification).toHaveBeenCalledTimes(2);

    // Вторая подряд — 2 с.
    await act(() => vi.advanceTimersByTimeAsync(1_999));
    expect(receiveNotification).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(1));
    await flush();
    expect(receiveNotification).toHaveBeenCalledTimes(3);

    // Успешный шаг сбрасывает счётчик: следующая ошибка — снова 1 с.
    await answer(textNotification(1));
    expect(receiveNotification).toHaveBeenCalledTimes(4);
    vi.mocked(receiveNotification).mockRejectedValueOnce(
      new GreenApiError('receiveNotification', 'network'),
    );
    await answer(textNotification(2));
    expect(receiveNotification).toHaveBeenCalledTimes(5);
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    await flush();
    expect(receiveNotification).toHaveBeenCalledTimes(6);
  });

  it('delete вернул result: false → пауза перед повтором, а не сразу receive', async () => {
    vi.useFakeTimers();
    vi.mocked(deleteNotification).mockResolvedValueOnce({ result: false });
    renderHook(() => useNotificationPolling());

    await answer(textNotification(1));
    expect(receiveNotification).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    await flush();
    expect(receiveNotification).toHaveBeenCalledTimes(2);
  });

  it('ошибка delete → после паузы то же уведомление без дубля в ленте', async () => {
    vi.useFakeTimers();
    vi.mocked(deleteNotification).mockRejectedValueOnce(
      new GreenApiError('deleteNotification', 'network'),
    );
    renderHook(() => useNotificationPolling());

    await answer(textNotification(1));
    expect(receiveNotification).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    await flush();
    await answer(textNotification(1));

    expect(vi.mocked(deleteNotification).mock.calls.map(([, receiptId]) => receiptId)).toEqual([
      1, 1,
    ]);
    expect(messages()).toHaveLength(1);
    expect(receiveNotification).toHaveBeenCalledTimes(3);
  });

  it('abort во время паузы останавливает цикл', async () => {
    vi.useFakeTimers();
    vi.mocked(receiveNotification).mockRejectedValueOnce(
      new GreenApiError('receiveNotification', 'network'),
    );
    const { unmount } = renderHook(() => useNotificationPolling());
    await flush();

    unmount();
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    await flush();

    expect(receiveNotification).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('useNotificationPolling: остановка по ошибке', () => {
  it.each([401, 403])(
    '%s от receive → цикл встал, причина credentials-rejected, новых запросов нет',
    async (status) => {
      vi.useFakeTimers();
      vi.mocked(receiveNotification).mockRejectedValueOnce(
        new GreenApiError('receiveNotification', 'http', status),
      );
      const { result } = renderHook(() => useNotificationPolling());
      await flush();

      expect(result.current).toBe('credentials-rejected');

      await act(() => vi.advanceTimersByTimeAsync(60_000));
      await flush();

      expect(receiveNotification).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('401 от delete тоже останавливает цикл', async () => {
    vi.useFakeTimers();
    vi.mocked(deleteNotification).mockRejectedValueOnce(
      new GreenApiError('deleteNotification', 'http', 401),
    );
    const { result } = renderHook(() => useNotificationPolling());

    await answer(textNotification(1));

    expect(result.current).toBe('credentials-rejected');
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(receiveNotification).toHaveBeenCalledTimes(1);
  });

  it('500 → как сеть: пауза и повтор, цикл работает', async () => {
    vi.useFakeTimers();
    vi.mocked(receiveNotification).mockRejectedValueOnce(
      new GreenApiError('receiveNotification', 'http', 500),
    );
    const { result } = renderHook(() => useNotificationPolling());
    await flush();

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    await flush();

    expect(result.current).toBeNull();
    expect(receiveNotification).toHaveBeenCalledTimes(2);
  });

  it('ошибка не GREEN-API (баг в коде) → цикл встал, причина unexpected-error, ошибка в консоли', async () => {
    vi.useFakeTimers();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bug = new TypeError('Cannot read properties of undefined');
    vi.mocked(receiveNotification).mockRejectedValueOnce(bug);
    const { result } = renderHook(() => useNotificationPolling());
    await flush();

    expect(result.current).toBe('unexpected-error');
    expect(consoleError).toHaveBeenCalledWith(bug);

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(receiveNotification).toHaveBeenCalledTimes(1);
  });

  it('новый вход после остановки → причина сброшена, цикл снова идёт', async () => {
    vi.mocked(receiveNotification).mockRejectedValueOnce(
      new GreenApiError('receiveNotification', 'http', 401),
    );
    const { result } = renderHook(() => useNotificationPolling());
    await flush();
    expect(result.current).toBe('credentials-rejected');

    act(() => {
      useSessionStore.getState().signOut();
      useSessionStore.getState().signIn({ ...credentials });
    });
    await flush();

    expect(result.current).toBeNull();
    expect(receiveNotification).toHaveBeenCalledTimes(2);
    expect(liveLoops()).toBe(1);
  });
});
