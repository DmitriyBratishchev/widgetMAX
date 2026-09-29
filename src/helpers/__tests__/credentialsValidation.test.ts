import { describe, expect, it } from 'vitest';
import { normalizeCredentials, validateCredentials } from '@/helpers/credentialsValidation';
import { TEST_CREDENTIALS } from '@/test/fixtures';

describe('validateCredentials', () => {
  it('корректные данные → нет ошибок', () => {
    expect(validateCredentials(TEST_CREDENTIALS)).toEqual({});
  });

  it('пустые поля → ошибка на каждом', () => {
    const errors = validateCredentials({ idInstance: ' ', apiTokenInstance: '', apiUrl: '' });

    expect(Object.keys(errors).toSorted()).toEqual(['apiTokenInstance', 'apiUrl', 'idInstance']);
  });

  it('idInstance не из цифр → ошибка', () => {
    expect(
      validateCredentials({ ...TEST_CREDENTIALS, idInstance: '1101abc' }).idInstance,
    ).toBeDefined();
  });

  it('apiUrl не https → ошибка', () => {
    expect(
      validateCredentials({ ...TEST_CREDENTIALS, apiUrl: 'http://1101.api.green-api.com' }).apiUrl,
    ).toBeDefined();
    expect(validateCredentials({ ...TEST_CREDENTIALS, apiUrl: 'не адрес' }).apiUrl).toBeDefined();
  });
});

describe('normalizeCredentials', () => {
  it('обрезает пробелы и слеш в конце apiUrl', () => {
    expect(
      normalizeCredentials({
        idInstance: ` ${TEST_CREDENTIALS.idInstance} `,
        apiTokenInstance: ` ${TEST_CREDENTIALS.apiTokenInstance} `,
        apiUrl: `${TEST_CREDENTIALS.apiUrl}/ `,
      }),
    ).toEqual(TEST_CREDENTIALS);
  });
});
