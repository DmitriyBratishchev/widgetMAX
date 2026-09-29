import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GreenApiError } from '@/api/greenApiClient';
import {
  EMPTY_QUEUE_PAUSE_MS,
  MAX_RETRY_DELAY_MS,
  RECEIVE_TIMEOUT_SECONDS,
  RETRY_DELAYS_MS,
  useNotificationPolling,
} from '@/hooks/useNotificationPolling';
import { deleteNotification, receiveNotification } from '@/services/notificationService';
import { useChatStore } from '@/stores/chatStore';
import { useSessionStore } from '@/stores/sessionStore';
import { TEST_CREDENTIALS } from '@/test/fixtures';
import type { ReceiveNotificationResponse } from '@/types/greenApi';

vi.mock('@/services/notificationService', () => ({
  receiveNotification: vi.fn<typeof receiveNotification>(),
  deleteNotification: vi.fn<typeof deleteNotification>(),
}));

const [FIRST_RETRY_DELAY_MS, SECOND_RETRY_DELAY_MS] = RETRY_DELAYS_MS;
// Дольше любой паузы цикла: если цикл жив, за это время он точно сделал бы новый запрос.
const LONGER_THAN_ANY_PAUSE_MS = MAX_RETRY_DELAY_MS * 2;

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

// Шаг цикла — цепочка промисов без таймеров. Сдвиг фейкового времени на 0 мс начинается с настоящей
// макрозадачи: к ней цепочка проходит целиком, а паузы цикла (setTimeout) не срабатывают.
async function settle() {
  await act(() => vi.advanceTimersByTimeAsync(0));
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

async function answer(notification: ReceiveNotificationResponse | null) {
  lastReceive().resolve(notification);
  await settle();
}

function messages() {
  return useChatStore.getState().messagesByChatId['10000000'] ?? [];
}

beforeEach(() => {
  vi.useFakeTimers();
  receives = [];
  vi.mocked(receiveNotification).mockImplementation(hangingReceive(true));
  vi.mocked(deleteNotification).mockResolvedValue({ result: true });
  useChatStore.getState().reset();
  useChatStore.getState().addChat({ chatId: '10000000', phone: '79991234567' });
  useSessionStore.getState().signIn(TEST_CREDENTIALS);
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
    expect(receiveNotification).toHaveBeenCalledWith(
      TEST_CREDENTIALS,
      RECEIVE_TIMEOUT_SECONDS,
      expect.any(AbortSignal),
    );

    await answer(textNotification(1));

    expect(messagesAtDelete).toBe(1);
    expect(deleteNotification).toHaveBeenCalledWith(TEST_CREDENTIALS, 1, expect.any(AbortSignal));
    expect(receiveNotification).toHaveBeenCalledTimes(1);

    finishDelete();
    await settle();

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

  it('пустая очередь (null) → без delete, следующий receive через паузу, а не сразу', async () => {
    renderHook(() => useNotificationPolling());

    await answer(null);

    expect(deleteNotification).not.toHaveBeenCalled();
    expect(receiveNotification).toHaveBeenCalledTimes(1);
    await advance(EMPTY_QUEUE_PAUSE_MS - 1);
    expect(receiveNotification).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(receiveNotification).toHaveBeenCalledTimes(2);
  });

  it('сервер мгновенно отвечает null (как MAX вживую) → не чаще запроса за паузу', async () => {
    vi.mocked(receiveNotification).mockResolvedValue(null);
    renderHook(() => useNotificationPolling());

    await advance(10 * EMPTY_QUEUE_PAUSE_MS);

    expect(vi.mocked(receiveNotification).mock.calls.length).toBeLessThanOrEqual(11);
  });
});

describe('useNotificationPolling: удаление каждого уведомления', () => {
  it('сообщение чата, которого нет в списке, удаляется без показа и без нового чата', async () => {
    renderHook(() => useNotificationPolling());

    await answer(textNotification(1, { chatId: '20000000' }));

    expect(deleteNotification).toHaveBeenCalledWith(TEST_CREDENTIALS, 1, expect.any(AbortSignal));
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
    expect(deleteNotification).toHaveBeenCalledWith(TEST_CREDENTIALS, 1, expect.any(AbortSignal));
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
    await settle();

    expect(signal.aborted).toBe(true);
    expect(receiveNotification).toHaveBeenCalledTimes(1);
  });

  it('выход из сессии обрывает цикл', async () => {
    renderHook(() => useNotificationPolling());
    const { signal } = lastReceive();

    act(() => useSessionStore.getState().signOut());
    await settle();

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
    await settle();

    expect(liveLoops()).toBe(1);

    await answer(textNotification(1));

    expect(messages()).toHaveLength(1);
    expect(deleteNotification).toHaveBeenCalledTimes(1);
    expect(liveLoops()).toBe(1);
  });
});

describe('useNotificationPolling: ошибки', () => {
  it('ошибка receive → пауза с растущим backoff, после успеха пауза сбрасывается', async () => {
    vi.mocked(receiveNotification)
      .mockRejectedValueOnce(new GreenApiError('receiveNotification', 'network'))
      .mockRejectedValueOnce(new GreenApiError('receiveNotification', 'http', 429));
    renderHook(() => useNotificationPolling());
    await settle();
    expect(receiveNotification).toHaveBeenCalledTimes(1);

    // Первая пауза.
    await advance(FIRST_RETRY_DELAY_MS - 1);
    expect(receiveNotification).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(receiveNotification).toHaveBeenCalledTimes(2);

    // Вторая подряд — длиннее.
    await advance(SECOND_RETRY_DELAY_MS - 1);
    expect(receiveNotification).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(receiveNotification).toHaveBeenCalledTimes(3);

    // Успешный шаг сбрасывает счётчик: следующая ошибка — снова первая пауза.
    await answer(textNotification(1));
    expect(receiveNotification).toHaveBeenCalledTimes(4);
    vi.mocked(receiveNotification).mockRejectedValueOnce(
      new GreenApiError('receiveNotification', 'network'),
    );
    await answer(textNotification(2));
    expect(receiveNotification).toHaveBeenCalledTimes(5);
    await advance(FIRST_RETRY_DELAY_MS);
    expect(receiveNotification).toHaveBeenCalledTimes(6);
  });

  it('delete вернул result: false → пауза перед повтором, а не сразу receive', async () => {
    vi.mocked(deleteNotification).mockResolvedValueOnce({ result: false });
    renderHook(() => useNotificationPolling());

    await answer(textNotification(1));
    expect(receiveNotification).toHaveBeenCalledTimes(1);

    await advance(FIRST_RETRY_DELAY_MS);
    expect(receiveNotification).toHaveBeenCalledTimes(2);
  });

  it('ошибка delete → после паузы то же уведомление без дубля в ленте', async () => {
    vi.mocked(deleteNotification).mockRejectedValueOnce(
      new GreenApiError('deleteNotification', 'network'),
    );
    renderHook(() => useNotificationPolling());

    await answer(textNotification(1));
    expect(receiveNotification).toHaveBeenCalledTimes(1);

    await advance(FIRST_RETRY_DELAY_MS);
    await answer(textNotification(1));

    expect(vi.mocked(deleteNotification).mock.calls.map(([, receiptId]) => receiptId)).toEqual([
      1, 1,
    ]);
    expect(messages()).toHaveLength(1);
    expect(receiveNotification).toHaveBeenCalledTimes(3);
  });

  it('abort во время паузы останавливает цикл', async () => {
    vi.mocked(receiveNotification).mockRejectedValueOnce(
      new GreenApiError('receiveNotification', 'network'),
    );
    const { unmount } = renderHook(() => useNotificationPolling());
    await settle();

    unmount();
    await advance(MAX_RETRY_DELAY_MS);

    expect(receiveNotification).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('useNotificationPolling: остановка по ошибке', () => {
  it.each([401, 403])(
    '%s от receive → цикл встал, причина credentials-rejected, новых запросов нет',
    async (status) => {
      vi.mocked(receiveNotification).mockRejectedValueOnce(
        new GreenApiError('receiveNotification', 'http', status),
      );
      const { result } = renderHook(() => useNotificationPolling());
      await settle();

      expect(result.current).toBe('credentials-rejected');

      await advance(LONGER_THAN_ANY_PAUSE_MS);

      expect(receiveNotification).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('401 от delete тоже останавливает цикл', async () => {
    vi.mocked(deleteNotification).mockRejectedValueOnce(
      new GreenApiError('deleteNotification', 'http', 401),
    );
    const { result } = renderHook(() => useNotificationPolling());

    await answer(textNotification(1));

    expect(result.current).toBe('credentials-rejected');
    await advance(LONGER_THAN_ANY_PAUSE_MS);
    expect(receiveNotification).toHaveBeenCalledTimes(1);
  });

  it('500 → как сеть: пауза и повтор, цикл работает', async () => {
    vi.mocked(receiveNotification).mockRejectedValueOnce(
      new GreenApiError('receiveNotification', 'http', 500),
    );
    const { result } = renderHook(() => useNotificationPolling());
    await settle();

    await advance(FIRST_RETRY_DELAY_MS);

    expect(result.current).toBeNull();
    expect(receiveNotification).toHaveBeenCalledTimes(2);
  });

  it('ошибка не GREEN-API (баг в коде) → цикл встал, причина unexpected-error, ошибка в консоли', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bug = new TypeError('Cannot read properties of undefined');
    vi.mocked(receiveNotification).mockRejectedValueOnce(bug);
    const { result } = renderHook(() => useNotificationPolling());
    await settle();

    expect(result.current).toBe('unexpected-error');
    expect(consoleError).toHaveBeenCalledWith(bug);

    await advance(LONGER_THAN_ANY_PAUSE_MS);
    expect(receiveNotification).toHaveBeenCalledTimes(1);
  });

  it('новый вход после остановки → причина сброшена, цикл снова идёт', async () => {
    vi.mocked(receiveNotification).mockRejectedValueOnce(
      new GreenApiError('receiveNotification', 'http', 401),
    );
    const { result } = renderHook(() => useNotificationPolling());
    await settle();
    expect(result.current).toBe('credentials-rejected');

    act(() => {
      useSessionStore.getState().signOut();
      useSessionStore.getState().signIn({ ...TEST_CREDENTIALS });
    });
    await settle();

    expect(result.current).toBeNull();
    expect(receiveNotification).toHaveBeenCalledTimes(2);
    expect(liveLoops()).toBe(1);
  });
});
