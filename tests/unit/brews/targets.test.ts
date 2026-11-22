import { describe, expect, it } from 'vitest';
import { TARGET_STATUS_LABEL, evaluateTarget, targetRangeText } from '@/lib/brews/targets';
import { extractionYield } from '@/lib/recipes/calc';

describe('evaluateTarget', () => {
  it('is in range between the ends, ends included', () => {
    expect(evaluateTarget(20.4, 19, 21)).toBe('in');
    expect(evaluateTarget(19, 19, 21)).toBe('in');
    expect(evaluateTarget(21, 19, 21)).toBe('in');
  });

  it('is below under the minimum and above over the maximum', () => {
    expect(evaluateTarget(18.9, 19, 21)).toBe('below');
    expect(evaluateTarget(21.1, 19, 21)).toBe('above');
  });

  it('handles open-ended targets', () => {
    expect(evaluateTarget(25, 19, null)).toBe('in');
    expect(evaluateTarget(18, 19, null)).toBe('below');
    expect(evaluateTarget(5, null, 21)).toBe('in');
    expect(evaluateTarget(22, null, 21)).toBe('above');
    expect(evaluateTarget(20, 20, 20)).toBe('in');
  });

  it('says nothing without a value or without a target', () => {
    expect(evaluateTarget(null, 19, 21)).toBeNull();
    expect(evaluateTarget(undefined, 19, 21)).toBeNull();
    expect(evaluateTarget(Number.NaN, 19, 21)).toBeNull();
    expect(evaluateTarget(20, null, null)).toBeNull();
    expect(evaluateTarget(20, undefined, undefined)).toBeNull();
  });

  it('has the labels the screens show', () => {
    expect(TARGET_STATUS_LABEL).toEqual({ in: 'In range', below: 'Below', above: 'Above' });
  });
});

describe('targetRangeText', () => {
  const pct = (n: number) => `${n}%`;
  it('writes the range in words', () => {
    expect(targetRangeText(19, 21, pct)).toBe('19%–21%');
    expect(targetRangeText(19, null, pct)).toBe('19% or more');
    expect(targetRangeText(null, 21, pct)).toBe('up to 21%');
    expect(targetRangeText(20, 20, pct)).toBe('20%');
    expect(targetRangeText(null, null, pct)).toBeNull();
  });
});

describe('extraction yield against the targets', () => {
  it('is TDS × beverage ÷ dose, then compared with the version targets', () => {
    const ey = extractionYield(1.4, 220, 15);
    expect(ey).toBe(20.5);
    expect(evaluateTarget(ey, 19, 21)).toBe('in');
    expect(evaluateTarget(extractionYield(1.2, 220, 15), 19, 21)).toBe('below'); // 17.6
    expect(evaluateTarget(extractionYield(1.6, 230, 15), 19, 21)).toBe('above'); // 24.5
  });

  it('uses the brew\'s dose, so a quick change to the dose changes the yield', () => {
    expect(extractionYield(1.4, 220, 16)).toBe(19.3);
  });

  it('is empty until TDS and beverage weight are both filled', () => {
    expect(extractionYield(null, 220, 15)).toBeNull();
    expect(extractionYield(1.4, null, 15)).toBeNull();
    expect(evaluateTarget(extractionYield(null, 220, 15), 19, 21)).toBeNull();
  });
});
