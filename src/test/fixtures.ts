import type { GreenApiCredentials } from '@/types/greenApi';

// Заведомо фейковые учётные данные: реальные в тесты не попадают (rules.md §7).
export const TEST_CREDENTIALS: GreenApiCredentials = {
  idInstance: '1101000000',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://1101.api.green-api.com',
};
