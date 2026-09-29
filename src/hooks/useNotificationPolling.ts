import { useEffect } from 'react';
import { parseNotification } from '@/helpers/notification';
import { deleteNotification, receiveNotification } from '@/services/notificationService';
import { useChatStore } from '@/stores/chatStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { GreenApiCredentials } from '@/types/greenApi';

// Long-poll: пока очередь пуста, запрос висит до 20 с (документация: 5–60).
export const RECEIVE_TIMEOUT_SECONDS = 20;
// Пауза после пустого ответа. На живом инстансе MAX (2026-09-29) receiveNotification вернул null
// за миллисекунды, а не через receiveTimeout, — без паузы цикл слал сотни запросов в секунду.
export const EMPTY_QUEUE_PAUSE_MS = 1_000;
// Пауза после ошибки (сеть, 429, 5xx): растёт до потолка, после успешного шага — сброс.
export const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

// DeleteNotification ответил result: false — уведомление осталось в очереди.
class NotificationNotDeletedError extends Error {}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}

// В ленту — только сообщения чатов из списка: очередь хранит события за 24 ч, и чужие чаты мы не
// заводим (ресёрч max-chat §5.3). Эхо своей отправки отсекает дедуп стора по idMessage.
function showMessage(body: unknown) {
  const message = parseNotification(body);
  if (!message) return;
  const { chats, addMessage } = useChatStore.getState();
  if (chats.some((chat) => chat.chatId === message.chatId)) addMessage(message);
}

// Строго последовательно: receive → обработать → delete → следующий receive (skill green-api §3).
// Удаляется каждое уведомление — иначе оно останется первым в очереди и приём встанет.
async function pollNotifications(credentials: GreenApiCredentials, signal: AbortSignal) {
  let failures = 0;
  while (!signal.aborted) {
    try {
      const notification = await receiveNotification(credentials, RECEIVE_TIMEOUT_SECONDS, signal);
      // После «Выйти» ответ старого цикла в стор не пишем.
      if (signal.aborted) return;
      if (notification) {
        showMessage(notification.body);
        const deleted = await deleteNotification(credentials, notification.receiptId, signal);
        // Не удалилось — receive тут же отдаст его снова: без паузы это горячий цикл.
        if (!deleted?.result) throw new NotificationNotDeletedError();
        failures = 0;
      } else {
        failures = 0;
        await pause(EMPTY_QUEUE_PAUSE_MS, signal);
      }
    } catch {
      if (signal.aborted) return;
      // Не удалённое уведомление придёт снова — дубль в ленту не попадёт (дедуп по idMessage).
      failures += 1;
      await pause(RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length) - 1], signal);
    }
  }
}

// Один цикл на сессию. Guard от двойного запуска в StrictMode — abort в cleanup: повторный mount
// обрывает первый цикл, а receive из очереди ничего не удаляет, так что оборванный запрос не теряет
// уведомлений.
export function useNotificationPolling() {
  const credentials = useSessionStore((s) => s.credentials);

  useEffect(() => {
    if (!credentials) return;
    const controller = new AbortController();
    void pollNotifications(credentials, controller.signal);
    return () => controller.abort();
  }, [credentials]);
}
