import type { ChatMessage } from '@/stores/chatStore';
import type { NotificationBody, NotificationMessageData } from '@/types/greenApi';

// Сообщения чата — только эти типы (skill green-api §4). outgoingAPIMessageReceived — эхо своей же
// отправки: дубль отсекает стор по idMessage, так что разбор эхо не отбрасывает.
// switch, а не таблица-объект: поиск по объекту нашёл бы и 'toString' из прототипа.
function directionOf(typeWebhook: unknown): ChatMessage['direction'] | null {
  switch (typeWebhook) {
    case 'incomingMessageReceived':
      return 'incoming';
    case 'outgoingMessageReceived':
    case 'outgoingAPIMessageReceived':
      return 'outgoing';
    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readText(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const messageData = value as NotificationMessageData;
  let text: unknown;
  if (messageData.typeMessage === 'textMessage') {
    text = messageData.textMessageData?.textMessage;
  } else if (messageData.typeMessage === 'extendedTextMessage') {
    // Путь по аналогии с WhatsApp-версией GREEN-API; для MAX не проверено (ресёрч §2.4).
    text = messageData.extendedTextMessageData?.text;
  }
  return typeof text === 'string' && text.trim() !== '' ? text : null;
}

// Уведомление очереди → сообщение чата или null. Никогда не бросает: исключение на кривом
// уведомлении не дало бы циклу дойти до deleteNotification, и очередь встала бы.
export function parseNotification(body: unknown): ChatMessage | null {
  if (!isRecord(body)) return null;
  const { typeWebhook, idMessage, timestamp, senderData, messageData } = body as NotificationBody;

  const direction = directionOf(typeWebhook);
  if (!direction) return null;
  if (typeof idMessage !== 'string' || idMessage === '') return null;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return null;

  const rawChatId = isRecord(senderData) ? senderData.chatId : undefined;
  if (typeof rawChatId !== 'string' && typeof rawChatId !== 'number') return null;
  const chatId = String(rawChatId);
  if (chatId === '') return null;

  const text = readText(messageData);
  if (text === null) return null;

  return { idMessage, chatId, text, direction, timestamp: timestamp * 1000 };
}
