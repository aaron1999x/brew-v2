import { describe, expect, it } from 'vitest';
import { keyStats, type KeyStatsFormat, type KeyStatsVersion } from '@/lib/recipes/key-stats';

const fmt: KeyStatsFormat = {
  weight: (g) => `${g} g`,
  temp: (c) => `${c} °C`,
  duration: (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
  tempUnit: 'c',
};

const base: KeyStatsVersion = {
  dose_g: 15,
  brew_water_g: 250,
  bypass_g: 0,
  bypass_timing: 'none',
  retention_ratio: null,
  temp_c: 93,
  grind_setting: '7.5',
  grind_microns: null,
  steps: [
    { id: 'p1', kind: 'pour', at_s: 0, target_g: 40 },
    { id: 'p2', kind: 'pour', at_s: 40, target_g: 250 },
  ],
};

const labels = (stats: { label: string }[]) => stats.map((s) => s.label);

describe('keyStats', () => {
  it('puts dose, water, ratio and temperature first, the rest second', () => {
    const { primary, secondary } = keyStats(base, undefined, fmt);
    expect(labels(primary)).toEqual(['Dose', 'Brew water', 'Ratio', 'Temperature']);
    expect(labels(secondary)).toContain('Grind');
    expect(labels(secondary)).toContain('Total time');
    expect(labels(secondary)).not.toContain('Bypass');
    expect(labels(secondary)).not.toContain('Overall ratio');
  });

  it('shows the grind setting with the grinder under it', () => {
    const grind = keyStats(base, '1Zpresso K-Ultra', fmt).secondary.find((s) => s.label === 'Grind');
    expect(grind).toEqual({ label: 'Grind', value: '7.5', sub: '1Zpresso K-Ultra' });
  });

  it('falls back to microns, and adds them to the sub line next to a setting', () => {
    const micronsOnly = keyStats({ ...base, grind_setting: null, grind_microns: 650 }, undefined, fmt);
    expect(micronsOnly.secondary.find((s) => s.label === 'Grind')).toEqual({
      label: 'Grind',
      value: '650 µm',
      sub: undefined,
    });
    const both = keyStats({ ...base, grind_microns: 650 }, 'K-Ultra', fmt);
    expect(both.secondary.find((s) => s.label === 'Grind')?.sub).toBe('K-Ultra · 650 µm');
  });

  it('shows bypass with its timing, and only when there is bypass', () => {
    const { secondary, primary } = keyStats({ ...base, bypass_g: 20, bypass_timing: 'after' }, undefined, fmt);
    expect(secondary.find((s) => s.label === 'Bypass')).toEqual({
      label: 'Bypass',
      value: '20 g',
      sub: 'after brewing',
    });
    expect(labels(secondary)).toContain('Overall ratio');
    expect(primary.find((s) => s.label === 'Ratio')?.value).toBe('1:16.7');
  });

  it('shows a temperature range when pours differ, in the user’s unit', () => {
    const steps = [
      { id: 'p1', kind: 'pour' as const, at_s: 0, target_g: 40, temp_c: 65 },
      { id: 'p2', kind: 'pour' as const, at_s: 40, target_g: 250, temp_c: 92 },
    ];
    expect(keyStats({ ...base, steps }, undefined, fmt).primary[3]?.value).toBe('65 → 92 °C');
    expect(keyStats({ ...base, steps }, undefined, { ...fmt, tempUnit: 'f' }).primary[3]?.value).toBe(
      '149 → 197.6 °F',
    );
  });

  it('shows one value when every pour uses the same temperature', () => {
    const steps = [
      { id: 'p1', kind: 'pour' as const, at_s: 0, target_g: 40, temp_c: 92 },
      { id: 'p2', kind: 'pour' as const, at_s: 40, target_g: 250, temp_c: 92 },
    ];
    expect(keyStats({ ...base, temp_c: 92, steps }, undefined, fmt).primary[3]?.value).toBe('92 °C');
  });
});
