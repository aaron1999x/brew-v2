import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETENTION,
  brewRatio,
  expectedFinalVolume,
  extractionYield,
  formatRatio,
  overallRatio,
  recipeNumbers,
} from '@/lib/recipes/calc';
import type { StepData } from '@/lib/recipes/steps';

describe('brewRatio', () => {
  it('is brew water over dose', () => {
    expect(brewRatio(15, 250)).toBeCloseTo(16.667, 3);
    expect(brewRatio(30, 500)).toBeCloseTo(16.667, 3);
    expect(brewRatio(60, 600)).toBe(10);
  });
  it('is null without a usable dose or water', () => {
    expect(brewRatio(null, 250)).toBeNull();
    expect(brewRatio(15, null)).toBeNull();
    expect(brewRatio(0, 250)).toBeNull();
    expect(brewRatio(-1, 250)).toBeNull();
    expect(brewRatio(Number.NaN, 250)).toBeNull();
  });
});

describe('formatRatio', () => {
  it('shows one decimal and drops a trailing .0', () => {
    expect(formatRatio(250 / 15)).toBe('1:16.7');
    expect(formatRatio(15)).toBe('1:15');
    expect(formatRatio(15.04)).toBe('1:15');
    expect(formatRatio(15.05)).toBe('1:15.1');
    expect(formatRatio(10)).toBe('1:10');
  });
  it('is null for no ratio', () => {
    expect(formatRatio(null)).toBeNull();
    expect(formatRatio(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('overallRatio', () => {
  it('adds bypass water to the brew water', () => {
    expect(overallRatio(60, 600, 300)).toBe(15);
    expect(overallRatio(15, 250, 50)).toBeCloseTo(20, 5);
  });
  it('equals the brew ratio with zero, missing or null bypass', () => {
    expect(overallRatio(15, 240, 0)).toBe(16);
    expect(overallRatio(15, 240)).toBe(16);
    expect(overallRatio(15, 240, null)).toBe(16);
  });
  it('is null without a usable dose or water', () => {
    expect(overallRatio(null, 240, 10)).toBeNull();
    expect(overallRatio(0, 240, 10)).toBeNull();
    expect(overallRatio(15, null, 10)).toBeNull();
  });
});

describe('expectedFinalVolume', () => {
  it('is brew water minus what the coffee holds back (2.0 g per g by default)', () => {
    expect(DEFAULT_RETENTION).toBe(2);
    expect(expectedFinalVolume({ doseG: 15, brewWaterG: 250 })).toBe(220);
  });
  it('uses a custom retention, including 0', () => {
    expect(expectedFinalVolume({ doseG: 15, brewWaterG: 250, retention: 1.5 })).toBe(227.5);
    expect(expectedFinalVolume({ doseG: 15, brewWaterG: 250, retention: 0 })).toBe(250);
    expect(expectedFinalVolume({ doseG: 15, brewWaterG: 250, retention: null })).toBe(220);
  });
  it('adds bypass water', () => {
    expect(expectedFinalVolume({ doseG: 15, brewWaterG: 250, bypassG: 50 })).toBe(270);
    expect(expectedFinalVolume({ doseG: 60, brewWaterG: 600, bypassG: 300 })).toBe(780);
    expect(expectedFinalVolume({ doseG: 15, brewWaterG: 250, bypassG: 0 })).toBe(220);
  });
  it('never goes below 0', () => {
    expect(expectedFinalVolume({ doseG: 200, brewWaterG: 100 })).toBe(0);
    expect(expectedFinalVolume({ doseG: 50, brewWaterG: 80, retention: 5 })).toBe(0);
  });
  it('is null without a dose or brew water', () => {
    expect(expectedFinalVolume({ doseG: null, brewWaterG: 250 })).toBeNull();
    expect(expectedFinalVolume({ doseG: 15, brewWaterG: null })).toBeNull();
  });
});

describe('extractionYield', () => {
  it('is TDS × beverage ÷ dose, to 0.1', () => {
    expect(extractionYield(1.4, 240, 15)).toBe(22.4);
    expect(extractionYield(1.35, 300, 18)).toBe(22.5);
    expect(extractionYield(1.38, 245, 15)).toBe(22.5);
  });
  it('is null without TDS, beverage weight or a positive dose', () => {
    expect(extractionYield(null, 240, 15)).toBeNull();
    expect(extractionYield(1.4, null, 15)).toBeNull();
    expect(extractionYield(1.4, 240, null)).toBeNull();
    expect(extractionYield(1.4, 240, 0)).toBeNull();
  });
});

describe('recipeNumbers', () => {
  const steps: StepData[] = [
    { id: 'a', kind: 'pour', at_s: 0, target_g: 30 },
    { id: 'b', kind: 'wait', at_s: 5, duration_s: 40 },
    { id: 'c', kind: 'pour', at_s: 45, target_g: 250 },
  ];

  it('collects the numbers the strip and the recipe page show', () => {
    const n = recipeNumbers({ dose_g: 15, brew_water_g: 250, bypass_g: 0, steps });
    expect(n.ratio).toBeCloseTo(16.667, 3);
    expect(n.overallRatio).toBeCloseTo(16.667, 3);
    expect(n.expectedFinalVolumeG).toBe(220);
    expect(n.totalTimeS).toBe(45);
    expect(n.bloom).toEqual({ amountG: 30, atS: 0, durationS: 5 });
  });

  it('handles no steps and nothing entered yet', () => {
    const n = recipeNumbers({ dose_g: null, brew_water_g: null });
    expect(n).toEqual({
      ratio: null,
      overallRatio: null,
      expectedFinalVolumeG: null,
      totalTimeS: null,
      bloom: null,
    });
  });

  it('counts bypass and a custom retention', () => {
    const n = recipeNumbers({
      dose_g: 60,
      brew_water_g: 600,
      bypass_g: 300,
      retention_ratio: 1,
    });
    expect(n.overallRatio).toBe(15);
    expect(n.expectedFinalVolumeG).toBe(840);
  });
});
