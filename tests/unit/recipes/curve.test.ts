import { describe, expect, it } from 'vitest';
import fixtureFile from '@/lib/recipes/__fixtures__/methods.json';
import { curveEnd, curveLine, curveMarkers, curveRows, niceMax } from '@/lib/recipes/curve';
import type { StepData } from '@/lib/recipes/steps';

const fixture = (key: string) => fixtureFile.fixtures.find((f) => f.key === key)!;
const stepsOf = (key: string) => fixture(key).version.steps as unknown as StepData[];

describe('curveLine', () => {
  it('rises straight up at each pour and stays flat in between', () => {
    expect(curveLine(stepsOf('v60'), 195)).toEqual([
      { t: 0, g: 0 },
      { t: 0, g: 30 },
      { t: 45, g: 30 },
      { t: 45, g: 150 },
      { t: 90, g: 150 },
      { t: 90, g: 250 },
      { t: 195, g: 250 },
    ]);
  });

  it('is a flat line at 0 g with no steps', () => {
    expect(curveLine([], 60)).toEqual([
      { t: 0, g: 0 },
      { t: 60, g: 0 },
    ]);
  });

  it('puts a pour at 0:00 on the start without repeating points', () => {
    const line = curveLine(stepsOf('switch'), 150);
    expect(line[0]).toEqual({ t: 0, g: 0 });
    expect(line[1]).toEqual({ t: 0, g: 240 });
    expect(new Set(line.map((p) => `${p.t}:${p.g}`)).size).toBe(line.length);
  });

  it('runs to the end of a 12-hour steep', () => {
    const steps = stepsOf('cold_brew');
    const line = curveLine(steps, curveEnd(steps));
    expect(line.at(-1)).toEqual({ t: 43_260, g: 600 });
  });

  it('never ends before its last point', () => {
    expect(curveLine([{ id: 'a', kind: 'pour', at_s: 100, target_g: 50 }], 10).at(-1)).toEqual({
      t: 100,
      g: 50,
    });
  });
});

describe('curveMarkers', () => {
  it('marks every step that is not a pour, at the water level it happens at', () => {
    expect(curveMarkers(stepsOf('v60')).map(({ t, g, kind, label }) => ({ t, g, kind, label }))).toEqual([
      { t: 10, g: 30, kind: 'swirl', label: 'Swirl' },
    ]);
    const aeropress = curveMarkers(stepsOf('aeropress'));
    expect(aeropress.map((m) => [m.kind, m.t, m.g])).toEqual([
      ['stir', 15, 220],
      ['wait', 25, 220],
      ['other', 115, 220],
      ['press', 125, 220],
    ]);
  });

  it('puts a step before the first pour at 0 g, labelled with its own name', () => {
    const [first] = curveMarkers(stepsOf('switch'));
    expect(first).toMatchObject({ kind: 'other', label: 'Close valve', g: 0, t: 0 });
  });
});

describe('curveEnd and niceMax', () => {
  it('ends after the last step, at least a minute out', () => {
    expect(curveEnd([])).toBe(60);
    expect(curveEnd(stepsOf('v60'))).toBe(90);
    expect(curveEnd(stepsOf('v60'), [195])).toBe(195);
    expect(curveEnd(stepsOf('cold_brew'))).toBe(43_260);
  });

  it('rounds an axis up to a round number', () => {
    expect(niceMax(250, 50)).toBe(250);
    expect(niceMax(251, 50)).toBe(300);
    expect(niceMax(8.8, 2)).toBe(10);
    expect(niceMax(0, 50)).toBe(50);
    expect(niceMax(Number.NaN, 50)).toBe(50);
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
