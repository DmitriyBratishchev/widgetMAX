import { greenApiRequest } from '@/api/greenApiClient';
import type {
  DeleteNotificationResponse,
  GreenApiCredentials,
  ReceiveNotificationResponse,
} from '@/types/greenApi';

// Long-poll: GREEN-API держит запрос до receiveTimeout секунд (5–60), пока очередь пуста,
// и отвечает `null`, если уведомлений так и не появилось.
export function receiveNotification(
  credentials: GreenApiCredentials,
  receiveTimeout: number,
  signal?: AbortSignal,
): Promise<ReceiveNotificationResponse | null> {
  return greenApiRequest<ReceiveNotificationResponse | null>(credentials, 'receiveNotification', {
    query: { receiveTimeout },
    signal,
  });
}

export function deleteNotification(
  credentials: GreenApiCredentials,
  receiptId: number,
  signal?: AbortSignal,
): Promise<DeleteNotificationResponse> {
  return greenApiRequest<DeleteNotificationResponse>(credentials, 'deleteNotification', {
    httpMethod: 'DELETE',
    pathSuffix: receiptId,
    signal,
  });
}
