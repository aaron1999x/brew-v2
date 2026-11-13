import { describe, expect, it } from 'vitest';
import { findViolations } from '../../scripts/lint-tokens.mjs';

describe('lint-tokens', () => {
  it('accepts token usage', () => {
    expect(
      findViolations('a { color: var(--color-text-primary); font-size: var(--type-body-size); }'),
    ).toEqual([]);
  });
  it('flags hex, rgb, rgba, hsl and px font sizes', () => {
    for (const css of [
      'a{color:#fff}',
      'a{color:#A1B2C3}',
      'a{color:rgb(0,0,0)}',
      'a{color:rgba(0,0,0,.5)}',
      'a{color:hsl(0 0% 0%)}',
      'a{font-size: 14px}',
      'a{font-size:1.5px;}',
    ]) {
      expect(findViolations(css).length, css).toBeGreaterThan(0);
    }
  });
  it('allows px for non-font properties and rem font sizes', () => {
    expect(findViolations('a{border:1px solid var(--color-border-subtle);font-size:1rem}')).toEqual(
      [],
    );
  });
  it('ignores comments', () => {
    expect(findViolations('/* color: #fff; font-size: 12px */ a{}')).toEqual([]);
  });
  it('reports line numbers', () => {
    expect(findViolations('a{}\nb{color:#000}')[0]?.line).toBe(2);
  });
});
