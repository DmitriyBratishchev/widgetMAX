import { greenApiRequest } from '@/api/greenApiClient';
import type {
  CheckAccountRequest,
  CheckAccountResponse,
  GreenApiCredentials,
  SendMessageRequest,
  SendMessageResponse,
} from '@/types/greenApi';

export function checkAccount(
  credentials: GreenApiCredentials,
  phoneNumber: number,
): Promise<CheckAccountResponse> {
  const body: CheckAccountRequest = { phoneNumber };
  return greenApiRequest<CheckAccountResponse>(credentials, 'checkAccount', {
    httpMethod: 'POST',
    body,
  });
}

export function sendMessage(
  credentials: GreenApiCredentials,
  body: SendMessageRequest,
): Promise<SendMessageResponse> {
  return greenApiRequest<SendMessageResponse>(credentials, 'sendMessage', {
    httpMethod: 'POST',
    body,
  });
}
