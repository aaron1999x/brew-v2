import { TEMP_LABEL } from '@/lib/units/format';
import { tempToDisplay } from '@/lib/units/convert';
import type { TempUnit } from '@/lib/units/types';
import { formatRatio, recipeNumbers } from './calc';
import { pourTemperatureTrail, type StepData } from './steps';

/** One key number: a label, a value and an optional muted line under it. */
export type KeyStat = { label: string; value: string; sub?: string };
export type KeyStats = { primary: KeyStat[]; secondary: KeyStat[] };

/** The slice of a recipe version the key numbers read. */
export type KeyStatsVersion = {
  dose_g: number;
  brew_water_g: number;
  bypass_g: number;
  bypass_timing: string;
  retention_ratio: number | null;
  temp_c: number | null;
  grind_setting: string | null;
  grind_microns: number | null;
  steps: readonly StepData[];
};

/** How a value is shown in the user's units (from `useUnits`). */
export type KeyStatsFormat = {
  weight: (grams: number) => string;
  temp: (celsius: number) => string;
  duration: (seconds: number) => string;
  tempUnit: TempUnit;
};

/**
 * The key numbers of a version in two tiers (as the prototype's recipe view groups them): the
 * numbers read while brewing, then the supporting ones. A stat with nothing to show is left out.
 */
export function keyStats(version: KeyStatsVersion, grinderName: string | undefined, fmt: KeyStatsFormat): KeyStats {
  const numbers = recipeNumbers({
    dose_g: version.dose_g,
    brew_water_g: version.brew_water_g,
    bypass_g: version.bypass_g,
    retention_ratio: version.retention_ratio,
    steps: [...version.steps],
  });

  // "65 → 92 °C" when the temperature changes pour by pour, in the user's unit.
  let temperature: string | null = version.temp_c != null ? fmt.temp(version.temp_c) : null;
  const trail = pourTemperatureTrail([...version.steps], version.temp_c);
  if (trail.length > 1) {
    const shown = trail.map((c) => tempToDisplay(c, fmt.tempUnit));
    const low = Math.min(...shown);
    const high = Math.max(...shown);
    if (low !== high) temperature = `${low} → ${high} ${TEMP_LABEL[fmt.tempUnit]}`;
  }

  const microns = version.grind_microns != null ? `${version.grind_microns} µm` : null;
  const setting = version.grind_setting?.trim() || null;
  const grindValue = setting ?? microns;
  const grindSub = [grinderName, setting ? microns : null].filter(Boolean).join(' · ') || undefined;

  const primary: KeyStat[] = [
    { label: 'Dose', value: fmt.weight(version.dose_g) },
    { label: 'Brew water', value: fmt.weight(version.brew_water_g) },
    { label: 'Ratio', value: formatRatio(numbers.ratio) ?? '' },
  ];
  if (temperature) primary.push({ label: 'Temperature', value: temperature });

  const secondary: KeyStat[] = [];
  if (grindValue) secondary.push({ label: 'Grind', value: grindValue, sub: grindSub });
  if (version.bypass_g > 0) {
    secondary.push({
      label: 'Bypass',
      value: fmt.weight(version.bypass_g),
      sub: version.bypass_timing === 'before' ? 'before brewing' : 'after brewing',
    });
  }
  if (numbers.overallRatio !== numbers.ratio) {
    const overall = formatRatio(numbers.overallRatio);
    if (overall) secondary.push({ label: 'Overall ratio', value: overall });
  }
  if (numbers.expectedFinalVolumeG != null) {
    secondary.push({ label: 'Expected volume', value: fmt.weight(numbers.expectedFinalVolumeG) });
  }
  if (numbers.totalTimeS != null) secondary.push({ label: 'Total time', value: fmt.duration(numbers.totalTimeS) });

  return { primary: primary.filter((s) => s.value !== ''), secondary };
}
