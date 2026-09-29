import { describe, expect, it } from 'vitest';
import { cx } from '@/helpers/cx';

describe('cx', () => {
  it('склеивает классы через пробел', () => {
    expect(cx('button', 'primary')).toBe('button primary');
  });

  it('пропускает false, null, undefined и пустую строку', () => {
    expect(cx('item', false, null, undefined, '', 'active')).toBe('item active');
  });

  it('без классов — пустая строка', () => {
    expect(cx(undefined, false)).toBe('');
  });
});
