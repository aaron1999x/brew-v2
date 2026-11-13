import { describe, expect, it } from 'vitest';
import { cx } from '@/lib/cx';
import { isDevToolsEnabled } from '@/lib/dev-tools';

describe('isDevToolsEnabled', () => {
  it('is off only in production', () => {
    expect(isDevToolsEnabled('production')).toBe(false);
    expect(isDevToolsEnabled('staging')).toBe(true);
    expect(isDevToolsEnabled('local')).toBe(true);
    expect(isDevToolsEnabled(undefined)).toBe(true);
  });
});

describe('cx', () => {
  it('joins truthy class names', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
  });
});
