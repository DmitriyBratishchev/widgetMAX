export interface GreenApiCredentials {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl: string;
}

export type StateInstance =
  'authorized' | 'notAuthorized' | 'blocked' | 'starting' | 'suspended' | 'pendingPassword';

export interface GetStateInstanceResponse {
  stateInstance: StateInstance;
}

export interface CheckAccountRequest {
  // Число, а не строка: 11–12 цифр в международном формате без «+» (skill green-api §2).
  phoneNumber: number;
}

export interface CheckAccountResponse {
  exist: boolean;
  // Числовая строка личного чата; при exist: false — пустая строка.
  chatId: string;
  fromCache?: boolean;
}

export interface SendMessageRequest {
  chatId: string;
  message: string;
}

export interface SendMessageResponse {
  idMessage: string;
}

// Уведомления очереди HTTP API (skill green-api §4). Поля тела опциональны: это данные из сети,
// разбор — защитный (src/helpers/notification.ts).
export interface NotificationSenderData {
  // Числовая строка личного чата; тип в ответе MAX не сверен вживую — разбор приводит к строке.
  chatId?: string | number;
  sender?: string;
  senderName?: string;
  chatName?: string;
}

export interface NotificationMessageData {
  typeMessage?: string;
  textMessageData?: { textMessage?: string };
  extendedTextMessageData?: { text?: string };
}

export interface NotificationBody {
  typeWebhook?: string;
  // Unix-время в секундах.
  timestamp?: number;
  idMessage?: string;
  senderData?: NotificationSenderData;
  messageData?: NotificationMessageData;
}

export interface ReceiveNotificationResponse {
  receiptId: number;
  body: NotificationBody;
}

export interface DeleteNotificationResponse {
  result: boolean;
  reason?: string;
}
