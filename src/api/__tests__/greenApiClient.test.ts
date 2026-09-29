import { afterEach, describe, expect, it, vi } from 'vitest';
import { GreenApiError, greenApiRequest, REQUEST_TIMEOUT_MS } from '@/api/greenApiClient';
import type { GreenApiCredentials } from '@/types/greenApi';

const credentials: GreenApiCredentials = {
  idInstance: '1101000000',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://1101.api.green-api.com/',
};

// Транспорт — нижний слой: подменить можно только fetch.
function stubFetch(implementation: typeof fetch) {
  const fetchMock = vi.fn<typeof fetch>(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// Зависшая сеть: ответа нет, пока запрос не оборвут.
function hangingFetch(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')), {
      once: true,
    });
  });
}

function fetchSignal(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls[0]?.[1]?.signal;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('greenApiRequest', () => {
  it('собирает URL {apiUrl}/waInstance{id}/{method}/{token} без лишнего слеша', async () => {
    const fetchMock = stubFetch(() =>
      Promise.resolve(new Response('{"stateInstance":"authorized"}', { status: 200 })),
    );

    const result = await greenApiRequest(credentials, 'getStateInstance');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://1101.api.green-api.com/waInstance1101000000/getStateInstance/test-token',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual({ stateInstance: 'authorized' });
  });

  it('query ставит после токена', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response('null', { status: 200 })));

    await greenApiRequest(credentials, 'receiveNotification', {
      query: { receiveTimeout: 20 },
      nullable: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://1101.api.green-api.com/waInstance1101000000/receiveNotification/test-token?receiveTimeout=20',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('pathSuffix ставит отдельным сегментом после токена', async () => {
    const fetchMock = stubFetch(() =>
      Promise.resolve(new Response('{"result":true}', { status: 200 })),
    );

    await greenApiRequest(credentials, 'deleteNotification', {
      httpMethod: 'DELETE',
      pathSuffix: 1234567,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://1101.api.green-api.com/waInstance1101000000/deleteNotification/test-token/1234567',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('ошибка запроса с query и pathSuffix — без токена в сообщении', async () => {
    stubFetch(() => Promise.resolve(new Response(null, { status: 429 })));

    const error = await greenApiRequest(credentials, 'deleteNotification', {
      httpMethod: 'DELETE',
      pathSuffix: 1234567,
      query: { receiveTimeout: 20 },
    }).catch((e: unknown) => e);

    expect(error).toMatchObject({ kind: 'http', status: 429 });
    expect(String(error)).not.toContain('test-token');
  });

  it('отправляет тело JSON с заголовком Content-Type', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response('{}', { status: 200 })));

    await greenApiRequest(credentials, 'sendMessage', {
      httpMethod: 'POST',
      body: { chatId: '10000000', message: 'Привет' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"chatId":"10000000","message":"Привет"}',
      }),
    );
  });

  it.each([
    ['пустое тело', ''],
    ['null', 'null'],
  ])('nullable: %s → null', async (_name, body) => {
    stubFetch(() => Promise.resolve(new Response(body, { status: 200 })));

    await expect(
      greenApiRequest(credentials, 'receiveNotification', { nullable: true }),
    ).resolves.toBeNull();
  });

  it.each([
    ['пустое тело', ''],
    ['null', 'null'],
    ['битый JSON', '{"idMessage":'],
    ['HTML', '<html>502 Bad Gateway</html>'],
  ])('%s на 200 → GreenApiError kind response, без токена в сообщении', async (_name, body) => {
    stubFetch(() => Promise.resolve(new Response(body, { status: 200 })));

    const error = await greenApiRequest(credentials, 'sendMessage').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GreenApiError);
    expect(error).toMatchObject({ kind: 'response' });
    expect(String(error)).not.toContain('test-token');
  });

  it('401 с пустым телом → GreenApiError со статусом, без токена в сообщении', async () => {
    stubFetch(() => Promise.resolve(new Response(null, { status: 401 })));

    const error = await greenApiRequest(credentials, 'getStateInstance').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GreenApiError);
    expect(error).toMatchObject({ kind: 'http', status: 401 });
    expect(String(error)).not.toContain('test-token');
  });

  it('404 с HTML-телом → ошибка по статусу, тело не разбирается', async () => {
    stubFetch(() => Promise.resolve(new Response('<html>404 Not Found</html>', { status: 404 })));

    await expect(greenApiRequest(credentials, 'getStateInstance')).rejects.toMatchObject({
      kind: 'http',
      status: 404,
    });
  });

  it('сбой сети → GreenApiError kind network', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(greenApiRequest(credentials, 'getStateInstance')).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('отмену запроса пробрасывает как есть', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    stubFetch(() => Promise.reject(abortError));

    await expect(greenApiRequest(credentials, 'getStateInstance')).rejects.toBe(abortError);
  });

  it('отмена сигналом вызывающего обрывает запрос и приходит как AbortError', async () => {
    const fetchMock = stubFetch(hangingFetch);
    const controller = new AbortController();

    const request = greenApiRequest(credentials, 'getStateInstance', {
      signal: controller.signal,
    }).catch((e: unknown) => e);
    controller.abort();

    expect(await request).toMatchObject({ name: 'AbortError' });
    expect(fetchSignal(fetchMock)?.aborted).toBe(true);
  });
});

describe('greenApiRequest: таймаут', () => {
  it('зависшая сеть → через REQUEST_TIMEOUT_MS запрос оборван, GreenApiError kind network', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(hangingFetch);

    const request = greenApiRequest(credentials, 'sendMessage').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(fetchSignal(fetchMock)?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    const error = await request;
    expect(error).toBeInstanceOf(GreenApiError);
    expect(error).toMatchObject({ kind: 'network' });
    expect(fetchSignal(fetchMock)?.aborted).toBe(true);
  });

  it('timeoutMs переопределяет таймаут по умолчанию', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(hangingFetch);

    const request = greenApiRequest(credentials, 'receiveNotification', {
      timeoutMs: REQUEST_TIMEOUT_MS + 10_000,
    }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(fetchSignal(fetchMock)?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);

    expect(await request).toMatchObject({ kind: 'network' });
  });

  it('после ответа таймер снят', async () => {
    vi.useFakeTimers();
    stubFetch(() => Promise.resolve(new Response('{"result":true}', { status: 200 })));

    await greenApiRequest(credentials, 'deleteNotification');

    expect(vi.getTimerCount()).toBe(0);
  });
});
