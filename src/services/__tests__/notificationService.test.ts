import { describe, expect, it, vi } from 'vitest';
import { greenApiRequest } from '@/api/greenApiClient';
import { deleteNotification, receiveNotification } from '@/services/notificationService';

vi.mock('@/api/greenApiClient', () => ({ greenApiRequest: vi.fn<typeof greenApiRequest>() }));

const credentials = {
  idInstance: '1101000000',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://1101.api.green-api.com',
};

describe('notificationService', () => {
  it('receiveNotification шлёт GET с receiveTimeout в query, signal, nullable и таймаутом сверх long-poll', async () => {
    const notification = { receiptId: 1234567, body: { typeWebhook: 'stateInstanceChanged' } };
    vi.mocked(greenApiRequest).mockResolvedValue(notification);
    const { signal } = new AbortController();

    await expect(receiveNotification(credentials, 20, signal)).resolves.toBe(notification);
    expect(greenApiRequest).toHaveBeenCalledWith(credentials, 'receiveNotification', {
      query: { receiveTimeout: 20 },
      signal,
      nullable: true,
      timeoutMs: 30_000,
    });
  });

  it('receiveNotification пробрасывает null пустой очереди', async () => {
    vi.mocked(greenApiRequest).mockResolvedValue(null);

    await expect(receiveNotification(credentials, 20)).resolves.toBeNull();
  });

  it('deleteNotification шлёт DELETE deleteNotification с receiptId сегментом пути', async () => {
    vi.mocked(greenApiRequest).mockResolvedValue({ result: true });
    const { signal } = new AbortController();

    await expect(deleteNotification(credentials, 1234567, signal)).resolves.toEqual({
      result: true,
    });
    expect(greenApiRequest).toHaveBeenCalledWith(credentials, 'deleteNotification', {
      httpMethod: 'DELETE',
      pathSuffix: 1234567,
      signal,
    });
  });
});
