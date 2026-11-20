import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtureFile from '@/lib/recipes/__fixtures__/methods.json';
import { formatRatio, recipeNumbers } from '@/lib/recipes/calc';
import { diffVersions } from '@/lib/recipes/diff';
import { recipeFormSchema, toRecipeRpcArgs } from '@/lib/recipes/schema';
import { lastPourWarning, validateSteps, type StepData } from '@/lib/recipes/steps';
import { formatClock } from '@/lib/units';

type Fixture = (typeof fixtureFile.fixtures)[number];
const byKey = (key: string): Fixture => fixtureFile.fixtures.find((f) => f.key === key)!;
const form = (f: Fixture) => ({
  name: f.name,
  method: f.method,
  method_custom: f.method_custom,
  version: f.version,
});

describe('method fixtures', () => {
  it('cover the five acceptance methods', () => {
    expect(fixtureFile.fixtures.map((f) => f.key)).toEqual([
      'v60',
      'switch',
      'aeropress',
      'french_press',
      'cold_brew',
    ]);
    expect(fixtureFile.fixtures.map((f) => f.method)).toEqual([
      'pour_over',
      'hybrid',
      'aeropress',
      'french_press',
      'cold_brew',
    ]);
  });

  it.each(fixtureFile.fixtures.map((f) => [f.key, f] as const))(
    '%s passes the recipe schema and the step rules',
    (_key, f) => {
      const parsed = recipeFormSchema.safeParse(form(f));
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(validateSteps(f.version.steps as StepData[])).toEqual([]);
      // What we send to the database is what we parsed: nothing is lost or added to the steps
      if (parsed.success) {
        expect(toRecipeRpcArgs(parsed.data).p_version.steps).toEqual(f.version.steps);
      }
    },
  );

  it.each(fixtureFile.fixtures.map((f) => [f.key, f] as const))(
    '%s: the last pour reaches the brew water',
    (_key, f) => {
      expect(lastPourWarning(f.version.steps as StepData[], f.version.brew_water_g)).toBeNull();
    },
  );

  it('V60: 15 g / 250 g at 93 °C, three pours and a swirl, drawdown 2:45 to 3:15', () => {
    const f = byKey('v60');
    const n = recipeNumbers({ ...f.version, steps: f.version.steps as StepData[] });
    expect(formatRatio(n.ratio)).toBe('1:16.7');
    expect(n.expectedFinalVolumeG).toBe(220);
    expect(n.totalTimeS).toBe(90);
    expect(n.bloom).toEqual({ amountG: 30, atS: 0, durationS: 10 });
    expect(f.version.temp_c).toBe(93);
    expect(f.version.steps.map((s) => s.kind)).toEqual(['pour', 'swirl', 'pour', 'pour']);
    expect(
      [f.version.drawdown_min_s, f.version.drawdown_max_s].map((s) => formatClock(s as number)),
    ).toEqual(['2:45', '3:15']);
  });

  it('Switch: closes the valve at 0:00, pours, stirs, waits 2:00 and opens the valve', () => {
    const steps = byKey('switch').version.steps as StepData[];
    expect(steps.map((s) => s.kind)).toEqual(['other', 'pour', 'stir', 'wait', 'other']);
    expect(steps.filter((s) => s.kind === 'other').map((s) => s.label)).toEqual([
      'Close valve',
      'Open valve',
    ]);
    expect(steps[3]).toMatchObject({ kind: 'wait', duration_s: 120 });
    expect(steps[0]!.at_s).toBe(steps[1]!.at_s);
  });

  it('AeroPress: inverted pour, stir, wait 1:30, flip, press', () => {
    const f = byKey('aeropress');
    expect(f.version.steps.map((s) => s.kind)).toEqual(['pour', 'stir', 'wait', 'other', 'press']);
    expect(f.version.steps[0]).toMatchObject({ target_g: 220, technique: 'Inverted' });
    expect(f.version.steps[2]).toMatchObject({ duration_s: 90 });
    expect(recipeNumbers({ ...f.version, steps: f.version.steps as StepData[] }).totalTimeS).toBe(
      155,
    );
  });

  it('French press: 30 g / 500 g, wait 4:00, break the crust, wait 5:00, press 20 s', () => {
    const f = byKey('french_press');
    expect([f.version.dose_g, f.version.brew_water_g]).toEqual([30, 500]);
    expect(f.version.steps.map((s) => s.kind)).toEqual(['pour', 'wait', 'other', 'wait', 'press']);
    expect(f.version.steps.filter((s) => s.kind === 'wait').map((s) => s.duration_s)).toEqual([
      240, 300,
    ]);
    expect(f.version.steps[4]).toMatchObject({ duration_s: 20 });
  });

  it('Cold brew: a 12-hour wait reads 12:00:00 and bypass goes in after', () => {
    const f = byKey('cold_brew');
    const wait = f.version.steps.find((s) => s.kind === 'wait')!;
    expect(wait.duration_s).toBe(43_200);
    expect(formatClock(wait.duration_s!)).toBe('12:00:00');
    expect([f.version.bypass_g, f.version.bypass_timing, f.version.temp_c]).toEqual([
      300,
      'after',
      20,
    ]);
    const n = recipeNumbers({ ...f.version, steps: f.version.steps as StepData[] });
    expect(n.overallRatio).toBe(15);
    expect(n.expectedFinalVolumeG).toBe(780);
    expect(n.totalTimeS).toBe(43_260);
  });

  it('are distinct recipes: comparing any two shows differences', () => {
    const a = recipeFormSchema.parse(form(byKey('v60')));
    const b = recipeFormSchema.parse(form(byKey('switch')));
    const d = diffVersions(
      { name: a.name, method: a.method, ...a.version },
      { name: b.name, method: b.method, ...b.version },
    );
    expect(d.count).toBeGreaterThan(5);
  });
});

describe('pgTAP fixture copies', () => {
  // supabase/tests/07_gear_recipes.sql inlines the fixtures as JSON; they must not drift from the file.
  const sql = readFileSync(join(process.cwd(), 'supabase/tests/07_gear_recipes.sql'), 'utf8');
  const copies = new Map<string, unknown>();
  for (const m of sql.matchAll(/^\\set fx_(\w+) '(.*)'$/gm)) copies.set(m[1]!, JSON.parse(m[2]!));

  it('has one copy per fixture', () => {
    expect([...copies.keys()].sort()).toEqual(fixtureFile.fixtures.map((f) => f.key).sort());
  });

  it.each(fixtureFile.fixtures.map((f) => [f.key, f] as const))(
    '%s matches methods.json',
    (key, f) => {
      expect(copies.get(key)).toEqual(f.version);
    },
  );
});
