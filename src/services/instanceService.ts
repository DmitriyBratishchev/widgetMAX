import { greenApiRequest } from '@/api/greenApiClient';
import type { GetStateInstanceResponse, GreenApiCredentials } from '@/types/greenApi';

export function getStateInstance(
  credentials: GreenApiCredentials,
): Promise<GetStateInstanceResponse> {
  return greenApiRequest<GetStateInstanceResponse>(credentials, 'getStateInstance');
}
