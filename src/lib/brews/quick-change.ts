import { roundTo } from '@/lib/units';
import type { StepData } from '@/lib/recipes/steps';
import type { QuickChange } from './schema';

/**
 * "Change for this brew": a dial-in tweak to grind setting, temperature, dose or brew water. It is
 * applied to a copy of the version for the timer and the log, and saved as the next version when the
 * brew is logged. Pure functions on metric values.
 */

/** The fields of a version a quick change can touch (a recipe version row satisfies this). */
export type QuickChangeBase = {
  dose_g: number;
  brew_water_g: number;
  temp_c: number | null;
  grind_setting: string | null;
  steps: readonly StepData[];
};

/** Stored weights and temperatures have one decimal, so anything closer than this is "the same". */
const EPSILON = 0.05;

const sameNumber = (a: number | null | undefined, b: number | null | undefined): boolean => {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(a - b) < EPSILON;
};

/** Trimmed grind text; an empty one means "not set". */
export function normalizeGrind(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
}

/** Only the fields that really differ from the version (a value put back to the original drops out). */
export function normalizeQuickChange(base: QuickChangeBase, change: QuickChange): QuickChange {
  const out: QuickChange = {};
  if (change.grindSetting !== undefined) {
    const grind = normalizeGrind(change.grindSetting);
    if (grind !== normalizeGrind(base.grind_setting)) out.grindSetting = grind;
  }
  if (change.tempC !== undefined && !sameNumber(change.tempC, base.temp_c)) {
    out.tempC = change.tempC ?? null;
  }
  if (change.doseG != null && !sameNumber(change.doseG, base.dose_g)) out.doseG = change.doseG;
  if (change.brewWaterG != null && !sameNumber(change.brewWaterG, base.brew_water_g)) {
    out.brewWaterG = change.brewWaterG;
  }
  return out;
}

/** True when the change leaves every value as the version has it: no new version is needed. */
export function isNoChange(base: QuickChangeBase, change: QuickChange | null | undefined): boolean {
  return !change || Object.keys(normalizeQuickChange(base, change)).length === 0;
}

export type ChangedField =
  | { field: 'grind'; from: string | null; to: string | null }
  | { field: 'temp'; from: number | null; to: number | null }
  | { field: 'dose'; from: number; to: number }
  | { field: 'water'; from: number; to: number };

/** What changed, in a fixed order (grind, temperature, dose, water), for the chips and the note. */
export function changedFields(base: QuickChangeBase, change: QuickChange | null | undefined): ChangedField[] {
  if (!change) return [];
  const c = normalizeQuickChange(base, change);
  const out: ChangedField[] = [];
  if ('grindSetting' in c) {
    out.push({ field: 'grind', from: normalizeGrind(base.grind_setting), to: c.grindSetting ?? null });
  }
  if ('tempC' in c) out.push({ field: 'temp', from: base.temp_c, to: c.tempC ?? null });
  if (c.doseG != null) out.push({ field: 'dose', from: base.dose_g, to: c.doseG });
  if (c.brewWaterG != null) out.push({ field: 'water', from: base.brew_water_g, to: c.brewWaterG });
  return out;
}

/**
 * Scales every pour target by new ÷ old water, to whole grams (never below 1 g, always above the
 * pour before it). A last pour that reached the old brew water becomes exactly the new brew water.
 */
function scalePours(steps: readonly StepData[], oldWater: number, newWater: number): StepData[] {
  const factor = newWater / oldWater;
  let lastPour = -1;
  steps.forEach((s, i) => {
    if (s.kind === 'pour' && s.target_g != null) lastPour = i;
  });
  let previous = 0;
  return steps.map((s, i) => {
    if (s.kind !== 'pour' || s.target_g == null) return s;
    let target: number;
    if (i === lastPour && sameNumber(s.target_g, oldWater)) {
      target = newWater;
    } else {
      target = Math.min(3000, Math.max(1, Math.round(s.target_g * factor)));
      if (target <= previous) target = Math.min(3000, previous + 1);
    }
    previous = target;
    return { ...s, target_g: target };
  });
}

/** Shifts every per-pour temperature by the same difference, clamped to 0–100 °C. */
function shiftTemps(steps: readonly StepData[], delta: number): StepData[] {
  return steps.map((s) =>
    s.temp_c == null
      ? s
      : { ...s, temp_c: Math.min(100, Math.max(0, roundTo(s.temp_c + delta, 1))) },
  );
}

/**
 * The version as it will be brewed. Brew water scales the pour targets; temperature moves the
 * recipe temperature and every per-pour temperature by the same difference; dose and grind change
 * only themselves. Bypass, step times and everything else stay as they are. Returns `base`
 * itself when nothing changes.
 */
export function applyQuickChange<T extends QuickChangeBase>(base: T, change: QuickChange | null | undefined): T {
  if (!change) return base;
  const c = normalizeQuickChange(base, change);
  if (Object.keys(c).length === 0) return base;

  let steps: readonly StepData[] = base.steps;
  if (c.brewWaterG != null) steps = scalePours(steps, base.brew_water_g, c.brewWaterG);
  if ('tempC' in c && c.tempC != null && base.temp_c != null) {
    steps = shiftTemps(steps, c.tempC - base.temp_c);
  }

  return {
    ...base,
    grind_setting: 'grindSetting' in c ? (c.grindSetting ?? null) : base.grind_setting,
    temp_c: 'tempC' in c ? (c.tempC ?? null) : base.temp_c,
    dose_g: c.doseG ?? base.dose_g,
    brew_water_g: c.brewWaterG ?? base.brew_water_g,
    steps: steps as T['steps'],
  };
}
