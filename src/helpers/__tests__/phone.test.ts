import { describe, expect, it } from 'vitest';
import { formatPhone, getPhoneAvatarLabel, normalizePhone } from '@/helpers/phone';

describe('normalizePhone', () => {
  it.each([
    ['+7 (999) 123-45-67', '79991234567'],
    ['8 999 123 45 67', '79991234567'],
    ['79991234567', '79991234567'],
    ['  +7 999 123.45.67 ', '79991234567'],
    ['+375 (29) 123-45-67', '375291234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('ведущая 8 меняется на 7 только у 11 цифр', () => {
    expect(normalizePhone('899912345678')).toBe('899912345678');
  });

  it.each([
    ['пусто', ''],
    ['буквы', '+7 999 abc 45 67'],
    ['меньше 11 цифр', '9991234567'],
    ['больше 12 цифр', '7999123456789'],
    ['«+» внутри номера не спасает буквы', '+7-999-123-45-6x'],
  ])('%s → null', (_, input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('formatPhone', () => {
  it('показывает номер с «+»', () => {
    expect(formatPhone('79991234567')).toBe('+79991234567');
  });
});

describe('getPhoneAvatarLabel', () => {
  it('две последние цифры номера', () => {
    expect(getPhoneAvatarLabel('79991234567')).toBe('67');
  });
});
