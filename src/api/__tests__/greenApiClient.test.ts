import { afterEach, describe, expect, it, vi } from 'vitest';
import { GreenApiError, greenApiRequest } from '@/api/greenApiClient';
import type { GreenApiCredentials } from '@/types/greenApi';

const credentials: GreenApiCredentials = {
  idInstance: '1101000000',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://1101.api.green-api.com/',
};

// Транспорт — нижний слой: подменить можно только fetch.
function stubFetch(implementation: () => Promise<Response>) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
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

    await greenApiRequest(credentials, 'receiveNotification', { query: { receiveTimeout: 20 } });

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
    expect((error as Error).message).not.toContain('test-token');
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

  it('возвращает null на пустом успешном ответе', async () => {
    stubFetch(() => Promise.resolve(new Response('', { status: 200 })));

    await expect(greenApiRequest(credentials, 'receiveNotification')).resolves.toBeNull();
  });

  it('401 с пустым телом → GreenApiError со статусом, без токена в сообщении', async () => {
    stubFetch(() => Promise.resolve(new Response(null, { status: 401 })));

    const error = await greenApiRequest(credentials, 'getStateInstance').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GreenApiError);
    expect(error).toMatchObject({ kind: 'http', status: 401 });
    expect((error as Error).message).not.toContain('test-token');
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
});
