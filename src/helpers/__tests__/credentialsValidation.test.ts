import { describe, expect, it } from 'vitest';
import { normalizeCredentials, validateCredentials } from '@/helpers/credentialsValidation';

const valid = {
  idInstance: '1101000000',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://1101.api.green-api.com',
};

describe('validateCredentials', () => {
  it('корректные данные → нет ошибок', () => {
    expect(validateCredentials(valid)).toEqual({});
  });

  it('пустые поля → ошибка на каждом', () => {
    const errors = validateCredentials({ idInstance: ' ', apiTokenInstance: '', apiUrl: '' });

    expect(Object.keys(errors).sort()).toEqual(['apiTokenInstance', 'apiUrl', 'idInstance']);
  });

  it('idInstance не из цифр → ошибка', () => {
    expect(validateCredentials({ ...valid, idInstance: '1101abc' }).idInstance).toBeDefined();
  });

  it('apiUrl не https → ошибка', () => {
    expect(
      validateCredentials({ ...valid, apiUrl: 'http://1101.api.green-api.com' }).apiUrl,
    ).toBeDefined();
    expect(validateCredentials({ ...valid, apiUrl: 'не адрес' }).apiUrl).toBeDefined();
  });
});

describe('normalizeCredentials', () => {
  it('обрезает пробелы и слеш в конце apiUrl', () => {
    expect(
      normalizeCredentials({
        idInstance: ' 1101000000 ',
        apiTokenInstance: ' test-token ',
        apiUrl: 'https://1101.api.green-api.com/ ',
      }),
    ).toEqual(valid);
  });
});
