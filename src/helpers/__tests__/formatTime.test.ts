import { describe, expect, it } from 'vitest';
import { formatMessageTime } from '@/helpers/formatTime';

describe('formatMessageTime', () => {
  it('показывает часы и минуты в поясе браузера', () => {
    const timestamp = new Date(2026, 8, 29, 9, 5).getTime();

    expect(formatMessageTime(timestamp)).toBe('09:05');
  });
});
