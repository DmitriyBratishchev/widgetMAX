import { describe, expect, it, vi } from 'vitest';
import { greenApiRequest } from '@/api/greenApiClient';
import { checkAccount, sendMessage } from '@/services/chatService';

vi.mock('@/api/greenApiClient', () => ({ greenApiRequest: vi.fn<typeof greenApiRequest>() }));

const credentials = {
  idInstance: '1101000000',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://1101.api.green-api.com',
};

describe('chatService', () => {
  it('checkAccount шлёт POST checkAccount с phoneNumber числом', async () => {
    vi.mocked(greenApiRequest).mockResolvedValue({ exist: true, chatId: '10000000' });

    await expect(checkAccount(credentials, 79991234567)).resolves.toEqual({
      exist: true,
      chatId: '10000000',
    });
    expect(greenApiRequest).toHaveBeenCalledWith(credentials, 'checkAccount', {
      httpMethod: 'POST',
      body: { phoneNumber: 79991234567 },
    });
  });

  it('sendMessage шлёт POST sendMessage с chatId и message', async () => {
    vi.mocked(greenApiRequest).mockResolvedValue({ idMessage: 'BAE5F4886F6F2D05' });

    await expect(
      sendMessage(credentials, { chatId: '10000000', message: 'Привет' }),
    ).resolves.toEqual({ idMessage: 'BAE5F4886F6F2D05' });
    expect(greenApiRequest).toHaveBeenCalledWith(credentials, 'sendMessage', {
      httpMethod: 'POST',
      body: { chatId: '10000000', message: 'Привет' },
    });
  });
});
