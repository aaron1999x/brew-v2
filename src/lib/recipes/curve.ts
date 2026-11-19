import { curvePoints, type StepData, type StepKind } from './steps';

/**
 * Data for the pour curve: cumulative water on the scale (grams) against time (seconds). Pure and in
 * metric; the chart converts to the person's units. A pour lifts the line straight up to its target
 * (the step's weight is what the scale reads after pouring); every other step sits on the line as a
 * marker at the current level.
 */
export type LinePoint = { t: number; g: number };

/** The line: from 0 g at 0:00, up at each pour, flat to `endS`. Steps are expected in time order. */
export function curveLine(steps: readonly StepData[], endS: number): LinePoint[] {
  const points: LinePoint[] = [{ t: 0, g: 0 }];
  const push = (point: LinePoint) => {
    const last = points[points.length - 1]!;
    if (last.t !== point.t || last.g !== point.g) points.push(point);
  };
  let level = 0;
  for (const p of curvePoints(steps)) {
    if (!p.isPour) continue;
    push({ t: p.t_s, g: level });
    push({ t: p.t_s, g: p.level_g });
    level = p.level_g;
  }
  const last = points[points.length - 1]!;
  push({ t: Math.max(endS, last.t), g: level });
  return points;
}

export type CurveMarker = { t: number; g: number; kind: StepKind; label: string; stepId: string };

/** Wait, swirl, stir, press and other steps: marked on the line at the level they happen at. */
export function curveMarkers(steps: readonly StepData[]): CurveMarker[] {
  return curvePoints(steps)
    .filter((p) => !p.isPour)
    .map((p) => ({ t: p.t_s, g: p.level_g, kind: p.kind, label: p.label, stepId: p.stepId }));
}

/** Where the chart ends: the end of the last step, never less than a minute. */
export function curveEnd(steps: readonly StepData[], extraS: number[] = []): number {
  const ends = [60, ...steps.map((s) => s.at_s + (s.duration_s ?? 0)), ...extraS];
  return Math.max(...ends);
}

export type CurveRow = { label: string; kind: StepKind; t: number; g: number };

/** Every step as a table row: the text alternative to the picture. */
export function curveRows(steps: readonly StepData[]): CurveRow[] {
  return curvePoints(steps).map((p) => ({ label: p.label, kind: p.kind, t: p.t_s, g: p.level_g }));
}

/** A round number above `value` to end an axis on (50 for grams, 2 for ounces…). */
export function niceMax(value: number, step: number): number {
  if (!Number.isFinite(value) || value <= 0) return step;
  return Math.ceil(value / step) * step;
}
