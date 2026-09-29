import { describe, expect, it } from 'vitest';
import { normalizeApiUrl, suggestApiUrl } from '@/helpers/apiUrl';

describe('suggestApiUrl', () => {
  it('строит хост из первых 4 цифр idInstance', () => {
    expect(suggestApiUrl('3100000000')).toBe('https://3100.api.green-api.com');
    expect(suggestApiUrl(' 7103123456 ')).toBe('https://7103.api.green-api.com');
  });

  it('меньше 4 цифр или не цифры → пустая строка', () => {
    expect(suggestApiUrl('')).toBe('');
    expect(suggestApiUrl('310')).toBe('');
    expect(suggestApiUrl('abcd1234')).toBe('');
  });
});

describe('normalizeApiUrl', () => {
  it('убирает пробелы и завершающие слеши', () => {
    expect(normalizeApiUrl('  https://3100.api.green-api.com//  ')).toBe(
      'https://3100.api.green-api.com',
    );
  });
});
