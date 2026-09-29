import { describe, expect, it } from 'vitest';
import { formatIsoDateTime, formatMessageTime } from '@/helpers/formatTime';

describe('formatMessageTime', () => {
  it('показывает часы и минуты в поясе браузера', () => {
    const timestamp = new Date(2026, 8, 29, 9, 5).getTime();

    expect(formatMessageTime(timestamp)).toBe('09:05');
  });
});

describe('formatIsoDateTime', () => {
  it('отдаёт ISO 8601 в UTC для атрибута dateTime', () => {
    expect(formatIsoDateTime(Date.UTC(2026, 8, 29, 9, 5))).toBe('2026-09-29T09:05:00.000Z');
  });
});
