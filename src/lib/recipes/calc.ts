import { roundTo } from '@/lib/units';
import { bloom, totalTimeS, type Bloom, type StepData } from './steps';

/**
 * Brew calculations, ported from the prototype and rewritten for the new model. Pure functions
 * on metric values; nothing here is stored (docs/phase-4-system-design.md §4).
 */

/** Grams of water a gram of coffee holds back when no retention is set. */
export const DEFAULT_RETENTION = 2.0;

const usable = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);

/** Brew water ÷ dose (16.67 for 250 g over 15 g), or null without a dose and water. */
export function brewRatio(doseG: number | null, brewWaterG: number | null): number | null {
  if (!usable(doseG) || !usable(brewWaterG) || doseG <= 0) return null;
  return brewWaterG / doseG;
}

/** (Brew water + bypass) ÷ dose: the ratio of everything in the cup. */
export function overallRatio(
  doseG: number | null,
  brewWaterG: number | null,
  bypassG: number | null = 0,
): number | null {
  if (!usable(doseG) || !usable(brewWaterG) || doseG <= 0) return null;
  return (brewWaterG + (usable(bypassG) ? bypassG : 0)) / doseG;
}

/** "1:16.7" (one decimal, a trailing .0 dropped: "1:15"). */
export function formatRatio(ratio: number | null): string | null {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  const rounded = roundTo(ratio, 1);
  return `1:${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}`;
}

/**
 * What ends up in the cup: brew water − dose × retention + bypass, never below 0.
 * Retention defaults to 2.0 g of water per g of coffee.
 */
export function expectedFinalVolume(input: {
  doseG: number | null;
  brewWaterG: number | null;
  bypassG?: number | null;
  retention?: number | null;
}): number | null {
  const { doseG, brewWaterG } = input;
  if (!usable(doseG) || !usable(brewWaterG)) return null;
  const retention = usable(input.retention) ? input.retention : DEFAULT_RETENTION;
  const bypass = usable(input.bypassG) ? input.bypassG : 0;
  return Math.max(0, brewWaterG - doseG * retention + bypass);
}

/**
 * Extraction yield % = TDS % × beverage weight ÷ dose, to 0.1 like the database's brew log.
 * Used from M4 on; null without a positive dose or without TDS and beverage weight.
 */
export function extractionYield(
  tdsPct: number | null,
  beverageG: number | null,
  doseG: number | null,
): number | null {
  if (!usable(tdsPct) || !usable(beverageG) || !usable(doseG) || doseG <= 0) return null;
  return roundTo((tdsPct * beverageG) / doseG, 1);
}

export type RecipeNumbersInput = {
  dose_g: number | null;
  brew_water_g: number | null;
  bypass_g?: number | null;
  retention_ratio?: number | null;
  steps?: readonly StepData[];
};

export type RecipeNumbers = {
  ratio: number | null;
  overallRatio: number | null;
  expectedFinalVolumeG: number | null;
  totalTimeS: number | null;
  bloom: Bloom | null;
};

/** Everything the live numbers strip and the recipe page show, in one call. */
export function recipeNumbers(input: RecipeNumbersInput): RecipeNumbers {
  const steps = input.steps ?? [];
  return {
    ratio: brewRatio(input.dose_g, input.brew_water_g),
    overallRatio: overallRatio(input.dose_g, input.brew_water_g, input.bypass_g),
    expectedFinalVolumeG: expectedFinalVolume({
      doseG: input.dose_g,
      brewWaterG: input.brew_water_g,
      bypassG: input.bypass_g,
      retention: input.retention_ratio,
    }),
    totalTimeS: totalTimeS(steps),
    bloom: bloom(steps),
  };
}
