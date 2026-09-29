import type { GreenApiCredentials } from '@/types/greenApi';

type GreenApiErrorKind = 'http' | 'network';

export class GreenApiError extends Error {
  readonly kind: GreenApiErrorKind;
  readonly status?: number;

  // В message только метод и статус: URL запроса содержит apiTokenInstance.
  constructor(method: string, kind: GreenApiErrorKind, status?: number) {
    super(
      kind === 'http'
        ? `GREEN-API ${method}: HTTP ${status}`
        : `GREEN-API ${method}: сеть недоступна`,
    );
    this.name = 'GreenApiError';
    this.kind = kind;
    this.status = status;
  }
}

interface GreenApiRequestOptions {
  httpMethod?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  // Параметры строки запроса: GREEN-API ждёт их после токена (`…/{token}?receiveTimeout=20`).
  query?: Record<string, string | number>;
  // Сегмент пути после токена: `deleteNotification/{token}/{receiptId}`.
  pathSuffix?: string | number;
}

function buildUrl(
  credentials: GreenApiCredentials,
  method: string,
  { query, pathSuffix }: Pick<GreenApiRequestOptions, 'query' | 'pathSuffix'>,
): string {
  const apiUrl = credentials.apiUrl.replace(/\/+$/, '');
  let url = `${apiUrl}/waInstance${credentials.idInstance}/${method}/${credentials.apiTokenInstance}`;
  if (pathSuffix !== undefined) url += `/${encodeURIComponent(String(pathSuffix))}`;
  if (query) {
    const params = new URLSearchParams(
      Object.entries(query).map(([key, value]) => [key, String(value)]),
    );
    url += `?${params.toString()}`;
  }
  return url;
}

export async function greenApiRequest<T>(
  credentials: GreenApiCredentials,
  method: string,
  { httpMethod = 'GET', body, signal, query, pathSuffix }: GreenApiRequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(credentials, method, { query, pathSuffix }), {
      method: httpMethod,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new GreenApiError(method, 'network');
  }

  // Тело ответа с ошибкой не разбираем: 401 приходит пустым, 404 — HTML-страницей nginx.
  if (!response.ok) throw new GreenApiError(method, 'http', response.status);

  const text = await response.text();
  // Ответ в рантайме не валидируется: T — контракт вызывающего.
  // eslint-disable-next-line typescript/no-unsafe-type-assertion -- см. выше
  return (text ? JSON.parse(text) : null) as T;
}
