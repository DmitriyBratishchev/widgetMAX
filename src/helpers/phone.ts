// Номер для CheckAccount — международный формат без «+» (skill green-api §2): столько цифр
// вместе с кодом страны.
export const PHONE_MIN_DIGITS = 11;
export const PHONE_MAX_DIGITS = 12;
// Российский номер: 11 цифр, в быту — с ведущей 8 вместо кода страны 7.
const RU_PHONE_DIGITS = 11;

// Разделители, которые люди ставят в номере: пробелы, скобки, дефисы, точки и «+».
const PHONE_SEPARATORS = /[\s()\-.+]/g;

// Российская запись с ведущей 8 (8 999 …) приводится к 7. Неверный формат → null.
export function normalizePhone(input: string): string | null {
  const digits = input.replace(PHONE_SEPARATORS, '');
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === RU_PHONE_DIGITS && digits.startsWith('8')) return `7${digits.slice(1)}`;
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) return null;
  return digits;
}

export function formatPhone(phone: string): string {
  return `+${phone}`;
}

// Подпись аватара: имён у собеседников нет, две последние цифры различают чаты в списке.
export function getPhoneAvatarLabel(phone: string): string {
  return phone.slice(-2);
}
