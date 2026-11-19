import { describe, expect, it } from 'vitest';
import fixtureFile from '@/lib/recipes/__fixtures__/methods.json';
import {
  DEFAULT_POUR_RATE_GPS,
  curveEnd,
  curveLine,
  curveMarkers,
  curveRows,
  curveSamples,
  firstPourStart,
  levelAt,
  niceTicks,
  pourRamps,
  readCurveAt,
  timeTicks,
  weightTicks,
} from '@/lib/recipes/curve';
import type { StepData } from '@/lib/recipes/steps';

const fixture = (key: string) => fixtureFile.fixtures.find((f) => f.key === key)!;
const stepsOf = (key: string) => fixture(key).version.steps as unknown as StepData[];
const pour = (id: string, at_s: number, target_g: number, rate_gps?: number): StepData => ({
  id,
  kind: 'pour',
  at_s,
  target_g,
  ...(rate_gps ? { rate_gps } : {}),
});

describe('pourRamps', () => {
  it('ramps from the previous target at the step’s time, at the default 5 g/s', () => {
    expect(DEFAULT_POUR_RATE_GPS).toBe(5);
    expect(pourRamps([pour('a', 0, 30), pour('b', 45, 150), pour('c', 90, 250)])).toEqual([
      { stepId: 'a', startS: 0, endS: 6, fromG: 0, toG: 30 },
      { stepId: 'b', startS: 45, endS: 69, fromG: 30, toG: 150 },
      { stepId: 'c', startS: 90, endS: 110, fromG: 150, toG: 250 },
    ]);
  });

  it('uses the step’s own rate when it has one', () => {
    expect(pourRamps([pour('a', 10, 50, 2.5)])).toEqual([
      { stepId: 'a', startS: 10, endS: 30, fromG: 0, toG: 50 },
    ]);
    // A rate of 0 or less is no rate: the default applies.
    expect(pourRamps([{ ...pour('a', 0, 50), rate_gps: 0 }])[0]!.endS).toBe(10);
  });

  it('never ends later than the next step: the ramp is steeper instead', () => {
    const [ramp] = pourRamps([
      pour('a', 0, 100),
      { id: 'w', kind: 'wait', at_s: 8, duration_s: 30 },
    ]);
    expect(ramp).toMatchObject({ startS: 0, endS: 8, toG: 100 });
  });

  it('is a straight jump when the next step starts at the same time', () => {
    const ramps = pourRamps([pour('a', 0, 100), pour('b', 0, 150)]);
    // The first is cut to nothing by the second; the second (the last step) ramps from 100 g.
    expect(ramps.map((r) => [r.startS, r.endS, r.fromG, r.toG])).toEqual([
      [0, 0, 0, 100],
      [0, 10, 100, 150],
    ]);
  });

  it('takes the amount from the previous pour, skipping other steps', () => {
    const ramps = pourRamps([
      pour('a', 0, 30),
      { id: 's', kind: 'swirl', at_s: 10, duration_s: 5 },
      pour('b', 45, 130),
    ]);
    expect(ramps[1]).toMatchObject({ fromG: 30, toG: 130, startS: 45, endS: 65 });
  });

  it('has no ramps without pours', () => {
    expect(pourRamps([])).toEqual([]);
    expect(pourRamps([{ id: 'w', kind: 'wait', at_s: 0, duration_s: 30 }])).toEqual([]);
  });
});

describe('curveLine', () => {
  it('rises along each ramp and is flat in between', () => {
    expect(curveLine(stepsOf('v60'), 195)).toEqual([
      { t: 0, g: 0 },
      { t: 6, g: 30 },
      { t: 45, g: 30 },
      { t: 69, g: 150 },
      { t: 90, g: 150 },
      { t: 110, g: 250 },
      { t: 195, g: 250 },
    ]);
  });

  it('is a flat line at 0 g with no steps', () => {
    expect(curveLine([], 60)).toEqual([
      { t: 0, g: 0 },
      { t: 60, g: 0 },
    ]);
  });

  it('keeps going flat at the last target to the end of the chart', () => {
    expect(curveLine([pour('a', 0, 30)], 120).at(-1)).toEqual({ t: 120, g: 30 });
  });

  it('never ends before its last point, even when the chart end is earlier', () => {
    expect(curveLine([pour('a', 100, 50)], 10).at(-1)).toEqual({ t: 110, g: 50 });
  });

  it('holds 0 g up to the first pour, then ramps', () => {
    expect(curveLine([pour('a', 30, 50)], 90)).toEqual([
      { t: 0, g: 0 },
      { t: 30, g: 0 },
      { t: 40, g: 50 },
      { t: 90, g: 50 },
    ]);
  });

  it('gives a pour at 0:00 that is cut short by the next step a steeper ramp, with no repeated points', () => {
    const line = curveLine(stepsOf('switch'), 150);
    expect(line.slice(0, 2)).toEqual([
      { t: 0, g: 0 },
      { t: 25, g: 240 },
    ]);
    expect(new Set(line.map((p) => `${p.t}:${p.g}`)).size).toBe(line.length);
  });

  it('runs to the end of a 12-hour steep', () => {
    const steps = stepsOf('cold_brew');
    const line = curveLine(steps, curveEnd(steps));
    expect(line.at(-1)).toEqual({ t: 43_260, g: 600 });
    expect(line[1]).toEqual({ t: 30, g: 600 });
  });

  it('never goes backwards in time or down in water', () => {
    for (const f of fixtureFile.fixtures) {
      const steps = f.version.steps as unknown as StepData[];
      const line = curveLine(steps, curveEnd(steps));
      for (let i = 1; i < line.length; i++) {
        expect(line[i]!.t).toBeGreaterThanOrEqual(line[i - 1]!.t);
        expect(line[i]!.g).toBeGreaterThanOrEqual(line[i - 1]!.g);
      }
    }
  });
});

describe('levelAt', () => {
  const line = curveLine(stepsOf('v60'), 195);

  it('reads along the ramps and the flat parts', () => {
    expect(levelAt(line, 0)).toBe(0);
    expect(levelAt(line, 3)).toBe(15);
    expect(levelAt(line, 6)).toBe(30);
    expect(levelAt(line, 20)).toBe(30);
    expect(levelAt(line, 57)).toBe(90);
    expect(levelAt(line, 100)).toBe(200);
    expect(levelAt(line, 195)).toBe(250);
  });

  it('stays at the last level after the line ends, and is 0 for an empty line', () => {
    expect(levelAt(line, 9999)).toBe(250);
    expect(levelAt([], 5)).toBe(0);
  });

  it('reads the value after a jump at the time of the jump', () => {
    const steep = curveLine([pour('a', 0, 100), pour('b', 0, 150)], 60);
    expect(levelAt(steep, 0)).toBe(100);
    expect(levelAt(steep, 5)).toBe(125);
  });
});

describe('curveMarkers', () => {
  it('marks every step that is not a pour, at the level the line has at that time', () => {
    expect(curveMarkers(stepsOf('v60')).map(({ t, g, kind, label }) => ({ t, g, kind, label }))).toEqual([
      { t: 10, g: 30, kind: 'swirl', label: 'Swirl' },
    ]);
    expect(curveMarkers(stepsOf('aeropress')).map((m) => [m.kind, m.t, m.g])).toEqual([
      ['stir', 15, 220],
      ['wait', 25, 220],
      ['other', 115, 220],
      ['press', 125, 220],
    ]);
  });

  it('puts a marker on the line where the ramp before it was cut short', () => {
    // The pour would take 20 s at 5 g/s; the stir at 10 s ends it, so the line is at 100 g by then.
    const markers = curveMarkers([
      pour('a', 0, 100),
      { id: 's', kind: 'stir', at_s: 10, duration_s: 5 },
      pour('b', 60, 150),
    ]);
    expect(markers[0]).toMatchObject({ kind: 'stir', t: 10, g: 100 });
  });

  it('puts a step before the first pour at 0 g, labelled with its own name', () => {
    const [first] = curveMarkers(stepsOf('switch'));
    expect(first).toMatchObject({ kind: 'other', label: 'Close valve', g: 0, t: 0 });
  });
});

describe('curveEnd and firstPourStart', () => {
  it('ends after the last step and the last ramp, at least a minute out', () => {
    expect(curveEnd([])).toBe(60);
    expect(curveEnd(stepsOf('v60'))).toBe(110);
    expect(curveEnd(stepsOf('v60'), [195])).toBe(195);
    expect(curveEnd(stepsOf('cold_brew'))).toBe(43_260);
  });

  it('knows when the first pour starts', () => {
    expect(firstPourStart(stepsOf('v60'))).toBe(0);
    expect(firstPourStart([pour('a', 30, 50)])).toBe(30);
    expect(firstPourStart([{ id: 'w', kind: 'wait', at_s: 0, duration_s: 5 }])).toBeNull();
  });
});

describe('readCurveAt (the tooltip)', () => {
  const steps = [pour('a', 0, 40), pour('b', 70, 90)];
  const line = curveLine(steps, 120);

  it('reads a pour’s target at the pour’s own time: at 1:10 it says 90 g, not 40 g', () => {
    expect(readCurveAt(steps, line, 70, 2)).toEqual({ t: 70, g: 90, pourId: 'b' });
  });

  it('snaps to the pour when the pointer is near its time, and says the pour’s time', () => {
    expect(readCurveAt(steps, line, 69, 2)).toEqual({ t: 70, g: 90, pourId: 'b' });
    expect(readCurveAt(steps, line, 71.5, 2)).toEqual({ t: 70, g: 90, pourId: 'b' });
  });

  it('reads the line itself away from a pour’s start', () => {
    expect(readCurveAt(steps, line, 40, 2)).toEqual({ t: 40, g: 40, pourId: null });
    // Half-way up the second ramp (70 → 80 s).
    expect(readCurveAt(steps, line, 75.5, 2)).toEqual({ t: 75.5, g: 40 + (50 * 5.5) / 10, pourId: null });
    expect(readCurveAt(steps, line, 100, 2)).toEqual({ t: 100, g: 90, pourId: null });
  });

  it('picks the nearest pour when two are close', () => {
    const close = [pour('a', 10, 30), pour('b', 14, 60)];
    const l = curveLine(close, 60);
    expect(readCurveAt(close, l, 13, 5).pourId).toBe('b');
    expect(readCurveAt(close, l, 11, 5).pourId).toBe('a');
  });
});

describe('curveSamples', () => {
  it('includes every bend of every line, an even grid, and the end', () => {
    const a = curveLine(stepsOf('v60'), 120);
    const b = curveLine([pour('x', 0, 100)], 120);
    const rows = curveSamples([a, b], 120, 12);
    const times = rows.map((r) => r.t);
    expect(times).toEqual([...times].sort((x, y) => x - y));
    expect(new Set(times).size).toBe(times.length);
    for (const t of [0, 6, 20, 45, 69, 90, 110, 120]) expect(times).toContain(t);
    expect(times.at(-1)).toBe(120);
    expect(rows.find((r) => r.t === 69)!.g).toEqual([150, 100]);
    expect(rows.every((r) => r.g.length === 2)).toBe(true);
  });

  it('stays small for a 12-hour brew', () => {
    const steps = stepsOf('cold_brew');
    const end = curveEnd(steps);
    expect(curveSamples([curveLine(steps, end)], end).length).toBeLessThan(200);
  });
});

describe('ticks', () => {
  it('labels weights with 3 to 5 round numbers and room above the highest', () => {
    expect(weightTicks(250, 'g')).toEqual({ ticks: [0, 100, 200, 300], top: 300 });
    expect(weightTicks(600, 'g')).toEqual({ ticks: [0, 200, 400, 600], top: 600 });
    expect(weightTicks(8.82, 'oz')).toEqual({ ticks: [0, 5, 10], top: 10 });
    expect(weightTicks(0, 'g').ticks[0]).toBe(0);
    for (const max of [30, 150, 250, 500, 1000]) {
      const { ticks, top } = weightTicks(max, 'g');
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(5);
      expect(top).toBeGreaterThanOrEqual(max);
    }
  });

  it('labels time with 3 to 5 round times from 0', () => {
    expect(timeTicks(110)).toEqual([0, 30, 60, 90]);
    expect(timeTicks(60)).toEqual([0, 15, 30, 45, 60]);
    expect(timeTicks(43_260)).toEqual([0, 10_800, 21_600, 32_400, 43_200]);
    for (const end of [5, 60, 110, 195, 600, 3600, 43_260, 172_800]) {
      const ticks = timeTicks(end);
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(5);
      expect(ticks[0]).toBe(0);
      expect(ticks.at(-1)!).toBeLessThanOrEqual(end);
    }
  });

  it('picks the finest step that fits, and copes with huge or bad input', () => {
    expect(niceTicks(7, [1, 5, 10]).ticks).toEqual([0, 5, 10].slice(0, 3));
    expect(niceTicks(Number.NaN, [10, 20]).ticks[0]).toBe(0);
    expect(niceTicks(1_000_000, [10, 20]).ticks).toHaveLength(5);
  });
});

describe('curveRows', () => {
  it('lists every step with its time and the water on the scale after it', () => {
    expect(curveRows(stepsOf('v60')).map((r) => [r.label, r.t, r.g])).toEqual([
      ['Pour 1', 0, 30],
      ['Swirl', 10, 30],
      ['Pour 2', 45, 150],
      ['Pour 3', 90, 250],
    ]);
  });
});
