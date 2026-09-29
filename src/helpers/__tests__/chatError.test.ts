import { describe, expect, it } from 'vitest';
import { GreenApiError } from '@/api/greenApiClient';
import {
  AccountNotFoundError,
  getCreateChatErrorMessage,
  getSendMessageErrorMessage,
} from '@/helpers/chatError';
import { TEST_CREDENTIALS } from '@/test/fixtures';

const httpError = (method: string, status: number) => new GreenApiError(method, 'http', status);

describe('getCreateChatErrorMessage', () => {
  it.each([
    [new AccountNotFoundError(), 'У этого номера нет аккаунта в MAX'],
    [httpError('checkAccount', 400), 'не смог проверить номер'],
    [httpError('checkAccount', 401), 'не принял учётные данные'],
    [httpError('checkAccount', 429), 'Слишком частые запросы'],
    [httpError('checkAccount', 466), 'до 3 чатов'],
    [httpError('checkAccount', 469), 'через 2 часа'],
    [new GreenApiError('checkAccount', 'network'), 'Нет связи с GREEN-API'],
    [httpError('checkAccount', 500), 'Не удалось создать чат'],
    [new Error('что-то ещё'), 'Не удалось создать чат'],
  ])('%s → понятный текст', (error, expected) => {
    const message = getCreateChatErrorMessage(error);

    expect(message).toContain(expected);
    expect(message).not.toContain(TEST_CREDENTIALS.apiTokenInstance);
  });
});

describe('getSendMessageErrorMessage', () => {
  it.each([
    [httpError('sendMessage', 400), 'не длиннее 4000 символов'],
    [httpError('sendMessage', 401), 'не принял учётные данные'],
    [httpError('sendMessage', 403), 'временно ограничена'],
    [httpError('sendMessage', 429), 'Слишком частые запросы'],
    [httpError('sendMessage', 466), 'до 3 чатов'],
    [new GreenApiError('sendMessage', 'network'), 'Нет связи с GREEN-API'],
    [httpError('sendMessage', 500), 'Не удалось отправить сообщение'],
  ])('%s → понятный текст', (error, expected) => {
    expect(getSendMessageErrorMessage(error)).toContain(expected);
  });
});
