import type { GreenApiCredentials } from '@/types/greenApi';

// Сколько ждём ответа: зависшая сеть не должна держать запрос (и isPending мутации) вечно.
export const REQUEST_TIMEOUT_MS = 30_000;

// http — ответ с кодом ошибки; network — сеть недоступна или не ответила за таймаут;
// response — код успешный, но тело не JSON или пустое там, где ответ обязателен.
type GreenApiErrorKind = 'http' | 'network' | 'response';

// В тексте только метод и статус: URL запроса содержит apiTokenInstance.
function describeError(method: string, kind: GreenApiErrorKind, status?: number): string {
  switch (kind) {
    case 'http':
      return `GREEN-API ${method}: HTTP ${status}`;
    case 'network':
      return `GREEN-API ${method}: сеть недоступна`;
    case 'response':
      return `GREEN-API ${method}: некорректный ответ`;
  }
}

export class GreenApiError extends Error {
  readonly kind: GreenApiErrorKind;
  readonly status?: number;

  constructor(method: string, kind: GreenApiErrorKind, status?: number) {
    super(describeError(method, kind, status));
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
  // Пустое тело или `null` — законный ответ (receiveNotification: очередь пуста). Без флага это
  // ошибка `response`: тип T не врёт, что пришли данные.
  nullable?: boolean;
  timeoutMs?: number;
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

function parseBody(method: string, text: string, nullable: boolean): unknown {
  let data: unknown = null;
  if (text !== '') {
    try {
      data = JSON.parse(text);
    } catch {
      throw new GreenApiError(method, 'response');
    }
  }
  if (data === null && !nullable) throw new GreenApiError(method, 'response');
  return data;
}

export async function greenApiRequest<T>(
  credentials: GreenApiCredentials,
  method: string,
  {
    httpMethod = 'GET',
    body,
    signal,
    query,
    pathSuffix,
    nullable = false,
    timeoutMs = REQUEST_TIMEOUT_MS,
  }: GreenApiRequestOptions = {},
): Promise<T> {
  // Свой контроллер обрывает запрос и по таймауту, и по отмене вызывающего.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    let text: string;
    try {
      const response = await fetch(buildUrl(credentials, method, { query, pathSuffix }), {
        method: httpMethod,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      // Тело ответа с ошибкой не разбираем: 401 приходит пустым, 404 — HTML-страницей nginx.
      if (!response.ok) throw new GreenApiError(method, 'http', response.status);
      text = await response.text();
    } catch (error) {
      if (error instanceof GreenApiError) throw error;
      // Таймаут для пользователя и цикла опроса — та же недоступная сеть.
      if (timedOut) throw new GreenApiError(method, 'network');
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new GreenApiError(method, 'network');
    }

    // Проверено, что тело — JSON и не пустое (или пустое разрешено); форму ответа не валидируем:
    // у методов она фиксирована контрактом, а изменчивое тело уведомления разбирает
    // parseNotification.
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- см. выше
    return parseBody(method, text, nullable) as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}
