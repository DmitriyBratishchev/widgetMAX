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
