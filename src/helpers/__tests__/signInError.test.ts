import { describe, expect, it } from 'vitest';
import { GreenApiError } from '@/api/greenApiClient';
import { getSignInErrorMessage, InstanceNotAuthorizedError } from '@/helpers/signInError';
import type { StateInstance } from '@/types/greenApi';

describe('getSignInErrorMessage', () => {
  it.each([
    [401, 'Неверный idInstance или apiTokenInstance'],
    [403, 'Неверный idInstance или apiTokenInstance'],
    [404, 'Инстанс не найден'],
    [429, 'Слишком частые запросы'],
  ])('HTTP %i → понятный текст', (status, expected) => {
    expect(getSignInErrorMessage(new GreenApiError('getStateInstance', 'http', status))).toContain(
      expected,
    );
  });

  it('сбой сети → текст про связь', () => {
    expect(getSignInErrorMessage(new GreenApiError('getStateInstance', 'network'))).toContain(
      'Нет связи с GREEN-API',
    );
  });

  it('notAuthorized → подсказка про QR-код', () => {
    expect(getSignInErrorMessage(new InstanceNotAuthorizedError('notAuthorized'))).toContain(
      'QR-код',
    );
  });

  it('у каждого не-authorized состояния свой текст', () => {
    const states: StateInstance[] = [
      'notAuthorized',
      'blocked',
      'starting',
      'suspended',
      'pendingPassword',
    ];
    const messages = states.map((state) =>
      getSignInErrorMessage(new InstanceNotAuthorizedError(state)),
    );

    expect(new Set(messages).size).toBe(states.length);
  });

  it('неизвестное состояние и прочие ошибки → общий текст без технических деталей', () => {
    expect(
      // Намеренно состояние вне типа — как незнакомый ответ сервера.
      // eslint-disable-next-line typescript/no-unsafe-type-assertion -- см. выше
      getSignInErrorMessage(new InstanceNotAuthorizedError('sleepMode' as StateInstance)),
    ).toContain('sleepMode');
    expect(getSignInErrorMessage(new GreenApiError('getStateInstance', 'http', 500))).toBe(
      'Не удалось войти. Попробуйте ещё раз.',
    );
    expect(getSignInErrorMessage(new Error('boom'))).toBe('Не удалось войти. Попробуйте ещё раз.');
  });
});
