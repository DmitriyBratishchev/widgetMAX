// Разделители, которые люди ставят в номере: пробелы, скобки, дефисы, точки и «+».
const PHONE_SEPARATORS = /[\s()\-.+]/g;

// Номер для CheckAccount: 11–12 цифр в международном формате без «+» (skill green-api §2).
// Российская запись с ведущей 8 (8 999 …) приводится к 7. Неверный формат → null.
export function normalizePhone(input: string): string | null {
  const digits = input.replace(PHONE_SEPARATORS, '');
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  if (digits.length < 11 || digits.length > 12) return null;
  return digits;
}

export function formatPhone(phone: string): string {
  return `+${phone}`;
}
