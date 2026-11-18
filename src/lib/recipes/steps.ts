import { DURATION_MAX_S, formatClock, roundTo } from '@/lib/units';

/**
 * Step logic: defaults, ordering rules, derived numbers. Pure functions on metric values
 * (seconds, grams, g/s, °C); screens format them with `useUnits`.
 * `target_g` is the cumulative scale weight (what the scale reads after the pour), as in the
 * prototype. Bloom, "+X g this pour" and total time are derived, never stored.
 */

export const STEP_KINDS = ['pour', 'wait', 'swirl', 'stir', 'press', 'other'] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const STEP_KIND_LABELS: Record<StepKind, string> = {
  pour: 'Pour',
  wait: 'Wait',
  swirl: 'Swirl',
  stir: 'Stir',
  press: 'Press',
  other: 'Other',
};

export const MAX_STEPS = 30;
export const STEP_TIME_MAX_S = DURATION_MAX_S;
export const LABEL_MAX = 60;
export const TECHNIQUE_MAX = 120;

/**
 * A step as the editor holds it and as the database stores it. Optional fields may be missing or
 * null while the form is being filled in (an empty field), and are left out of the saved JSON.
 */
export type StepData = {
  id: string;
  kind: StepKind;
  /** Seconds from the start of the brew. */
  at_s: number;
  duration_s?: number | null;
  /** Pours only: cumulative scale weight in grams. */
  target_g?: number | null;
  /** Pours only: g/s. */
  rate_gps?: number | null;
  /** Pours only: °C, when "Vary temperature by pour" is on. */
  temp_c?: number | null;
  /** "Other" steps only. */
  label?: string | null;
  technique?: string | null;
};

export function newStepId(): string {
  return globalThis.crypto.randomUUID();
}

/** Where the step finishes: its time plus its duration (0 when it has none). */
export function stepEndS(step: Pick<StepData, 'at_s' | 'duration_s'>): number {
  return step.at_s + (step.duration_s ?? 0);
}

// ---------------------------------------------------------------------------------------------
// Defaults for a new step (every default stays editable)
// ---------------------------------------------------------------------------------------------

export type StepContext = {
  dose_g: number | null;
  brew_water_g: number | null;
};

const DEFAULT_DURATION_S: Partial<Record<StepKind, number>> = {
  wait: 30,
  swirl: 5,
  stir: 5,
  press: 30,
};

/** The next step starts when the one before it ends, or 30 s after a pour. */
export function defaultStepTime(steps: readonly StepData[]): number {
  const prev = steps.at(-1);
  if (!prev) return 0;
  const next = prev.kind === 'pour' ? prev.at_s + 30 : stepEndS(prev);
  return Math.min(next, STEP_TIME_MAX_S);
}

const roundToFive = (g: number): number => Math.round(g / 5) * 5;

/**
 * The scale weight a new pour starts with: the first pour is 2 × dose (the bloom); later pours go
 * half-way from the last pour to brew water, rounded to 5 g (and always above the last pour).
 * Null when there is nothing to base it on yet (no dose).
 */
export function defaultPourTarget(steps: readonly StepData[], ctx: StepContext): number | null {
  const lastTarget = lastPourTarget(steps);
  if (lastTarget == null) {
    if (ctx.dose_g == null || ctx.dose_g <= 0) return null;
    const bloom = roundTo(ctx.dose_g * 2, 1);
    return ctx.brew_water_g != null && ctx.brew_water_g > 0
      ? Math.min(bloom, ctx.brew_water_g)
      : bloom;
  }
  const water = ctx.brew_water_g ?? lastTarget + 100;
  let next = roundToFive(lastTarget + (water - lastTarget) / 2);
  if (next <= lastTarget) next = lastTarget + 5;
  return Math.min(next, 3000);
}

export function lastPourTarget(steps: readonly StepData[]): number | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]!;
    if (s.kind === 'pour' && s.target_g != null) return s.target_g;
  }
  return null;
}

/** A new step of this kind, filled in with the defaults above, ready to append. */
export function defaultNewStep(
  kind: StepKind,
  steps: readonly StepData[],
  ctx: StepContext,
  id: string = newStepId(),
): StepData {
  const base = { id, kind, at_s: defaultStepTime(steps) };
  if (kind === 'pour') return { ...base, target_g: defaultPourTarget(steps, ctx) };
  if (kind === 'other') return { ...base, label: '' };
  return { ...base, duration_s: DEFAULT_DURATION_S[kind] ?? null };
}

// ---------------------------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------------------------

export type StepIssueCode = 'out_of_order' | 'pour_not_rising' | 'label_required';

export type StepIssue = {
  /** Position in the list (0-based). */
  index: number;
  stepId: string;
  code: StepIssueCode;
  /** The field the error belongs to, for the error summary link. */
  field: 'at_s' | 'target_g' | 'label';
  message: string;
};

/**
 * Errors that block saving: a step that starts before the one above it, a pour whose target isn't
 * higher than the previous pour's, an "other" step with no label. Equal times are fine (the Switch
 * closes its valve and pours at 0:00).
 */
export function validateSteps(steps: readonly StepData[]): StepIssue[] {
  const issues: StepIssue[] = [];
  let prevPour: { index: number; target: number } | null = null;
  steps.forEach((step, index) => {
    const n = index + 1;
    const before = steps[index - 1];
    if (before && step.at_s < before.at_s) {
      issues.push({
        index,
        stepId: step.id,
        code: 'out_of_order',
        field: 'at_s',
        message: `Step ${n} starts before step ${index}`,
      });
    }
    if (step.kind === 'pour' && step.target_g != null) {
      if (prevPour && step.target_g <= prevPour.target) {
        issues.push({
          index,
          stepId: step.id,
          code: 'pour_not_rising',
          field: 'target_g',
          message: `Step ${n} must reach a higher weight than the pour at step ${prevPour.index + 1}`,
        });
      }
      prevPour = { index, target: step.target_g };
    }
    if (step.kind === 'other' && !(step.label ?? '').trim()) {
      issues.push({
        index,
        stepId: step.id,
        code: 'label_required',
        field: 'label',
        message: `Step ${n} needs a label`,
      });
    }
  });
  return issues;
}

export type StepWarning = {
  code: 'last_pour_not_brew_water';
  lastPourG: number;
  brewWaterG: number;
};

/** Not an error: the last pour should normally reach the brew water. Null when it does. */
export function lastPourWarning(
  steps: readonly StepData[],
  brewWaterG: number | null,
): StepWarning | null {
  const last = lastPourTarget(steps);
  if (last == null || brewWaterG == null) return null;
  if (Math.abs(last - brewWaterG) < 0.05) return null;
  return { code: 'last_pour_not_brew_water', lastPourG: last, brewWaterG };
}

/** "Your last pour reaches 240 g; brew water is 250 g" with the caller's weight formatter. */
export function lastPourWarningMessage(
  warning: StepWarning,
  formatWeight: (grams: number) => string,
): string {
  return `Your last pour reaches ${formatWeight(warning.lastPourG)}; brew water is ${formatWeight(warning.brewWaterG)}`;
}

// ---------------------------------------------------------------------------------------------
// Editing helpers (return new arrays; never mutate)
// ---------------------------------------------------------------------------------------------

/** Orders steps by time, keeping the current order for steps at the same time. */
export function sortStepsByTime<T extends Pick<StepData, 'at_s'>>(steps: readonly T[]): T[] {
  return steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => a.step.at_s - b.step.at_s || a.index - b.index)
    .map((x) => x.step);
}

/** Moves one step up or down; returns the same order when it is already at the edge. */
export function moveStep<T>(steps: readonly T[], index: number, direction: 'up' | 'down'): T[] {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= steps.length || target < 0 || target >= steps.length) return [...steps];
  const next = [...steps];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** Removes a step and says what was removed and where (for the undo toast). */
export function removeStep<T>(
  steps: readonly T[],
  index: number,
): { steps: T[]; removed: T | null } {
  if (index < 0 || index >= steps.length) return { steps: [...steps], removed: null };
  const next = [...steps];
  const [removed] = next.splice(index, 1);
  return { steps: next, removed: removed ?? null };
}

/** Puts a step back at an index (undo of {@link removeStep}). */
export function insertStep<T>(steps: readonly T[], index: number, step: T): T[] {
  const next = [...steps];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, step);
  return next;
}

export function hasPourTemperatures(steps: readonly StepData[]): boolean {
  return steps.some((s) => s.kind === 'pour' && s.temp_c != null);
}

/** Turning off "Vary temperature by pour": drops every per-pour temperature. */
export function clearPourTemperatures<T extends StepData>(steps: readonly T[]): T[] {
  return steps.map((s) => (s.temp_c == null ? s : { ...s, temp_c: null }));
}

// ---------------------------------------------------------------------------------------------
// Derived numbers
// ---------------------------------------------------------------------------------------------

/** "+X g this pour" for every pour: its target minus the previous pour's (the first from 0). */
export function pourDeltas(steps: readonly StepData[]): Map<string, number> {
  const deltas = new Map<string, number>();
  let previous = 0;
  for (const step of steps) {
    if (step.kind !== 'pour' || step.target_g == null) continue;
    deltas.set(step.id, roundTo(step.target_g - previous, 2));
    previous = step.target_g;
  }
  return deltas;
}

/** Total brew time: the last step's time plus its duration. Null when there are no steps. */
export function totalTimeS(steps: readonly StepData[]): number | null {
  const last = steps.at(-1);
  return last ? stepEndS(last) : null;
}

export type Bloom = {
  /** The first pour's target: what the scale reads after the bloom. */
  amountG: number;
  atS: number;
  /** Seconds until the next step; null when the first pour is the last step. */
  durationS: number | null;
};

/** The first pour and the time until the step after it. Null when there is no pour. */
export function bloom(steps: readonly StepData[]): Bloom | null {
  const index = steps.findIndex((s) => s.kind === 'pour' && s.target_g != null);
  if (index < 0) return null;
  const pour = steps[index]!;
  const next = steps[index + 1];
  return {
    amountG: pour.target_g as number,
    atS: pour.at_s,
    durationS: next ? Math.max(0, next.at_s - pour.at_s) : null,
  };
}

/** "Pour 2", "Wait", "Close valve": what a step is called in lists and change summaries. */
export function stepLabel(steps: readonly StepData[], index: number): string {
  const step = steps[index];
  if (!step) return '';
  if (step.kind === 'other') return step.label?.trim() || STEP_KIND_LABELS.other;
  const sameKind = steps.slice(0, index + 1).filter((s) => s.kind === step.kind).length;
  const total = steps.filter((s) => s.kind === step.kind).length;
  return total > 1 ? `${STEP_KIND_LABELS[step.kind]} ${sameKind}` : STEP_KIND_LABELS[step.kind];
}

/** "Step 3 · Pour · 1:10" for a card heading, and "Step 3, pour, 1:10" for the group's name. */
export function stepHeading(
  steps: readonly StepData[],
  index: number,
): { visible: string; accessible: string } {
  const step = steps[index];
  if (!step) return { visible: '', accessible: '' };
  const kind = STEP_KIND_LABELS[step.kind];
  const time = formatClock(step.at_s);
  return {
    visible: `Step ${index + 1} · ${kind} · ${time}`,
    accessible: `Step ${index + 1}, ${kind.toLowerCase()}, ${time}`,
  };
}

export type CurvePoint = {
  stepId: string;
  kind: StepKind;
  label: string;
  t_s: number;
  /** Cumulative water on the scale after this step (0 before the first pour). */
  level_g: number;
  end_s: number;
  isPour: boolean;
};

/**
 * One point per step for the pour curve: pours move the level to their target; every other step
 * sits at the current level (it is drawn as a marker). The chart draws the line through the pours.
 */
export function curvePoints(steps: readonly StepData[]): CurvePoint[] {
  let level = 0;
  return steps.map((step, index) => {
    const isPour = step.kind === 'pour' && step.target_g != null;
    if (isPour) level = step.target_g as number;
    return {
      stepId: step.id,
      kind: step.kind,
      label: stepLabel(steps, index),
      t_s: step.at_s,
      level_g: level,
      end_s: stepEndS(step),
      isPour,
    };
  });
}
