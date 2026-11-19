import { curvePoints, type StepData, type StepKind } from './steps';

/**
 * Data for the pour curve: cumulative water on the scale (grams) against time (seconds). Pure and in
 * metric; the chart converts to the person's units.
 *
 * A pour is a ramp, not a jump: it starts at the step's time, rises from the previous target to its
 * own over (amount ÷ rate) seconds, then stays flat until the next pour. The rate is the step's
 * `rate_gps`, or {@link DEFAULT_POUR_RATE_GPS} when none is set. A ramp never ends later than the next
 * step's time (it is steeper instead), so the line is always at a pour's target by the time the next
 * thing happens. Every other step sits on the line as a marker.
 */
export const DEFAULT_POUR_RATE_GPS = 5;

export type LinePoint = { t: number; g: number };

export type Ramp = {
  stepId: string;
  /** When the pour starts, and when the line reaches its target. */
  startS: number;
  endS: number;
  fromG: number;
  toG: number;
};

/** Each pour's ramp, in step order. Steps are expected in time order (the editor enforces it). */
export function pourRamps(steps: readonly StepData[]): Ramp[] {
  const ramps: Ramp[] = [];
  let level = 0;
  steps.forEach((step, index) => {
    if (step.kind !== 'pour' || step.target_g == null) return;
    const amount = Math.max(0, step.target_g - level);
    const rate = step.rate_gps != null && step.rate_gps > 0 ? step.rate_gps : DEFAULT_POUR_RATE_GPS;
    const next = steps[index + 1];
    const wanted = step.at_s + amount / rate;
    const endS = Math.max(step.at_s, next ? Math.min(wanted, next.at_s) : wanted);
    ramps.push({ stepId: step.id, startS: step.at_s, endS, fromG: level, toG: step.target_g });
    level = step.target_g;
  });
  return ramps;
}

/** The line: 0 g at 0:00, flat to each pour, up its ramp, flat again, out to `endS`. */
export function curveLine(steps: readonly StepData[], endS: number): LinePoint[] {
  const points: LinePoint[] = [{ t: 0, g: 0 }];
  const push = (point: LinePoint) => {
    const last = points[points.length - 1]!;
    if (last.t !== point.t || last.g !== point.g) points.push(point);
  };
  let level = 0;
  for (const ramp of pourRamps(steps)) {
    push({ t: ramp.startS, g: level });
    push({ t: ramp.endS, g: ramp.toG });
    level = ramp.toG;
  }
  push({ t: Math.max(endS, points[points.length - 1]!.t), g: level });
  return points;
}

/**
 * The water on the line at time `t`, between its points. At a time where the line jumps, the value
 * after the jump. Before the line starts it is 0; after it ends it stays at the last level.
 */
export function levelAt(line: readonly LinePoint[], t: number): number {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    if (t < b.t) {
      if (t <= a.t) return a.g;
      return a.g + ((b.g - a.g) * (t - a.t)) / (b.t - a.t);
    }
  }
  return line[line.length - 1]?.g ?? 0;
}

/** When the first pour starts, or null when there is no pour: before it the line is "not started". */
export function firstPourStart(steps: readonly StepData[]): number | null {
  return pourRamps(steps)[0]?.startS ?? null;
}

export type CurveMarker = { t: number; g: number; kind: StepKind; label: string; stepId: string };

/** Wait, swirl, stir, press and other steps: marked on the line, at the level the line has then. */
export function curveMarkers(steps: readonly StepData[], endS?: number): CurveMarker[] {
  const line = curveLine(steps, endS ?? curveEnd(steps));
  return curvePoints(steps)
    .filter((p) => !p.isPour)
    .map((p) => ({
      t: p.t_s,
      g: levelAt(line, p.t_s),
      kind: p.kind,
      label: p.label,
      stepId: p.stepId,
    }));
}

/** Where the chart ends: after the last step and the last ramp, never less than a minute. */
export function curveEnd(steps: readonly StepData[], extraS: number[] = []): number {
  const ends = [
    60,
    ...steps.map((s) => s.at_s + (s.duration_s ?? 0)),
    ...pourRamps(steps).map((r) => r.endS),
    ...extraS,
  ];
  return Math.max(...ends);
}

export type CurveRow = { label: string; kind: StepKind; t: number; g: number };

/** Every step as a table row: the text alternative to the picture. */
export function curveRows(steps: readonly StepData[]): CurveRow[] {
  return curvePoints(steps).map((p) => ({ label: p.label, kind: p.kind, t: p.t_s, g: p.level_g }));
}

export type HoverReading = { t: number; g: number; pourId: string | null };

/**
 * What the tooltip says for a hovered time. Near a pour's start (within `snapS`) it reads that pour's
 * time and its target (what the scale shows after pouring), so "1:10" says 90 g, not where the ramp
 * happens to be; anywhere else it reads the line itself.
 */
export function readCurveAt(
  steps: readonly StepData[],
  line: readonly LinePoint[],
  t: number,
  snapS: number,
): HoverReading {
  let nearest: Ramp | null = null;
  for (const ramp of pourRamps(steps)) {
    const distance = Math.abs(ramp.startS - t);
    if (distance <= snapS && (!nearest || distance < Math.abs(nearest.startS - t))) nearest = ramp;
  }
  if (nearest) return { t: nearest.startS, g: nearest.toG, pourId: nearest.stepId };
  return { t, g: levelAt(line, t), pourId: null };
}

/**
 * The rows the chart is drawn from: every time the line bends, plus an even grid so hovering can land
 * anywhere. Each row has the water for every line at that time (the lines share these times).
 */
export function curveSamples(
  lines: readonly (readonly LinePoint[])[],
  endS: number,
  gridCount = 160,
): { t: number; g: number[] }[] {
  const times = new Set<number>();
  for (const line of lines) for (const p of line) times.add(p.t);
  for (let i = 0; i <= gridCount; i++) times.add((endS * i) / gridCount);
  return [...times]
    .filter((t) => t <= endS)
    .sort((a, b) => a - b)
    .map((t) => ({ t, g: lines.map((line) => levelAt(line, t)) }));
}

export type Ticks = { ticks: number[]; top: number };

/**
 * Round numbers to label an axis: from 0 up to `top` (at least `max`), in the smallest of `steps`
 * that keeps the count at `maxCount` or fewer. (Smaller steps give more ticks, so the first that fits
 * is the one with the most ticks allowed; for a tiny `max` that can be fewer than three.)
 */
export function niceTicks(max: number, steps: readonly number[], maxCount = 5): Ticks {
  const safeMax = Number.isFinite(max) && max > 0 ? max : steps[0]!;
  for (const step of steps) {
    const top = Math.round(Math.ceil(safeMax / step - 1e-9) * step * 1000) / 1000;
    const count = Math.round(top / step) + 1;
    if (count <= maxCount) {
      return { ticks: Array.from({ length: count }, (_, i) => Math.round(i * step * 1000) / 1000), top };
    }
  }
  // Larger than the biggest step allows: spread the ticks evenly.
  const top = Math.ceil(safeMax / (maxCount - 1)) * (maxCount - 1);
  const step = top / (maxCount - 1);
  return { ticks: Array.from({ length: maxCount }, (_, i) => i * step), top };
}

const TIME_STEPS_S = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 600, 900, 1200, 1800, 3600, 7200, 10800, 14400, 21600, 43200, 86400];
const GRAM_STEPS = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
const OUNCE_STEPS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200];

/** 3–5 time ticks from 0 to `endS` (ticks stop at the last whole step inside the chart). */
export function timeTicks(endS: number): number[] {
  for (const step of TIME_STEPS_S) {
    const count = Math.floor(endS / step) + 1;
    if (count <= 5 && count >= 3) return Array.from({ length: count }, (_, i) => i * step);
  }
  // A very short or very long brew: three evenly spaced ticks.
  return [0, endS / 2, endS];
}

/** 3–5 weight ticks (in the display unit) and the top of the axis. */
export function weightTicks(maxDisplay: number, unit: 'g' | 'oz'): Ticks {
  return niceTicks(maxDisplay, unit === 'oz' ? OUNCE_STEPS : GRAM_STEPS);
}
