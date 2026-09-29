import { describe, expect, it, vi } from 'vitest';
import { greenApiRequest } from '@/api/greenApiClient';
import { checkAccount, sendMessage } from '@/services/chatService';
import { TEST_CREDENTIALS } from '@/test/fixtures';

vi.mock('@/api/greenApiClient', () => ({ greenApiRequest: vi.fn<typeof greenApiRequest>() }));

describe('chatService', () => {
  it('checkAccount шлёт POST checkAccount с phoneNumber числом', async () => {
    vi.mocked(greenApiRequest).mockResolvedValue({ exist: true, chatId: '10000000' });

    await expect(checkAccount(TEST_CREDENTIALS, 79991234567)).resolves.toEqual({
      exist: true,
      chatId: '10000000',
    });
    expect(greenApiRequest).toHaveBeenCalledWith(TEST_CREDENTIALS, 'checkAccount', {
      httpMethod: 'POST',
      body: { phoneNumber: 79991234567 },
    });
  });

  it('sendMessage шлёт POST sendMessage с chatId и message', async () => {
    vi.mocked(greenApiRequest).mockResolvedValue({ idMessage: 'BAE5F4886F6F2D05' });

    await expect(
      sendMessage(TEST_CREDENTIALS, { chatId: '10000000', message: 'Привет' }),
    ).resolves.toEqual({ idMessage: 'BAE5F4886F6F2D05' });
    expect(greenApiRequest).toHaveBeenCalledWith(TEST_CREDENTIALS, 'sendMessage', {
      httpMethod: 'POST',
      body: { chatId: '10000000', message: 'Привет' },
    });
  });
});
