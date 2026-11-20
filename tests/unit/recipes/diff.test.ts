import { describe, expect, it } from 'vitest';
import { diffVersions, versionDiffInput, type DiffInput } from '@/lib/recipes/diff';
import { versionSchema } from '@/lib/recipes/schema';
import type { StepData } from '@/lib/recipes/steps';

const steps: StepData[] = [
  { id: 's1', kind: 'pour', at_s: 0, target_g: 30 },
  { id: 's2', kind: 'swirl', at_s: 10, duration_s: 5 },
  { id: 's3', kind: 'pour', at_s: 45, target_g: 100 },
  { id: 's4', kind: 'pour', at_s: 90, target_g: 250 },
];

const make = (over: Record<string, unknown> = {}, extra: Partial<DiffInput> = {}): DiffInput => ({
  name: 'Morning V60',
  method: 'pour_over',
  method_custom: null,
  ...versionSchema.parse({ dose_g: 15, brew_water_g: 250, temp_c: 93, steps, ...over }),
  ...extra,
});

const keys = (a: DiffInput, b: DiffInput) => [...diffVersions(a, b).changedKeys].sort();

describe('diffVersions: fields', () => {
  it('reports nothing for identical versions', () => {
    const d = diffVersions(make(), make());
    expect(d.count).toBe(0);
    expect(d.fields).toEqual([]);
    expect(d.steps).toEqual([]);
    expect(Object.values(d.sections).every((s) => !s.changed && s.count === 0)).toBe(true);
  });

  it('reports exactly the numbers that changed, with old and new values', () => {
    const d = diffVersions(make(), make({ grind_setting: '21', temp_c: 92 }));
    expect(d.count).toBe(2);
    expect(keys(make(), make({ grind_setting: '21', temp_c: 92 }))).toEqual([
      'numbers.grind_setting',
      'numbers.temp_c',
    ]);
    expect(d.fields.find((f) => f.key === 'numbers.temp_c')).toMatchObject({
      section: 'numbers',
      label: 'Temperature',
      type: 'temperature',
      before: 93,
      after: 92,
    });
    expect(d.fields.find((f) => f.key === 'numbers.grind_setting')).toMatchObject({
      before: null,
      after: '21',
    });
    expect(d.sections.numbers).toEqual({ changed: true, count: 2 });
    expect(d.sections.coffee.changed).toBe(false);
  });

  it('covers every number field', () => {
    const changed = make({
      dose_g: 16,
      brew_water_g: 260,
      bypass_g: 40,
      bypass_timing: 'after',
      retention_ratio: 1.5,
      temp_c: 90,
      grind_setting: '20',
      grind_microns: 600,
      water_ppm: 80,
    });
    expect(keys(make(), changed)).toEqual(
      [
        'numbers.brew_water_g',
        'numbers.bypass_g',
        'numbers.bypass_timing',
        'numbers.dose_g',
        'numbers.grind_microns',
        'numbers.grind_setting',
        'numbers.retention_ratio',
        'numbers.temp_c',
        'numbers.water_ppm',
      ].sort(),
    );
  });

  it('covers the coffee section', () => {
    const changed = make({
      coffee_name: 'Gesha',
      roaster: 'Onyx',
      origin: 'Panama',
      process: 'Washed',
      varietal: 'Gesha',
      altitude_m: 1800,
      roast_level: 'light',
      roast_date: '2026-11-14',
      colour_reading: 88.5,
      colour_scale: 'Agtron',
    });
    const d = diffVersions(make(), changed);
    expect(d.sections.coffee.count).toBe(10);
    expect(d.fields.every((f) => f.section === 'coffee')).toBe(true);
    expect(d.fields.find((f) => f.key === 'coffee.roast_date')).toMatchObject({
      type: 'date',
      after: '2026-11-14',
    });
  });

  it('covers the targets section', () => {
    const changed = make({
      drawdown_min_s: 165,
      drawdown_max_s: 195,
      tds_min: 1.3,
      tds_max: 1.5,
      ey_min: 19,
      ey_max: 21,
    });
    const d = diffVersions(make(), changed);
    expect(d.sections.targets.count).toBe(6);
    expect(d.fields.find((f) => f.key === 'targets.drawdown_min_s')).toMatchObject({
      type: 'duration',
    });
  });

  it('covers notes, and ignores the change note', () => {
    expect(keys(make(), make({ notes: 'Sweeter' }))).toEqual(['notes.notes']);
    expect(diffVersions(make(), make({ change_note: 'finer grind' })).count).toBe(0);
  });

  it('compares gear by the name saved on each version, per category', () => {
    const a = make({ gear: { brewer: { name: 'Hario V60 02' }, grinder: { name: 'C40' } } });
    const b = make({
      gear: {
        brewer: { name: 'Hario V60 02' },
        grinder: { name: 'K6' },
        kettle: { name: 'Stagg' },
      },
    });
    expect(keys(a, b)).toEqual(['gear.grinder', 'gear.kettle']);
    expect(diffVersions(a, b).fields.find((f) => f.key === 'gear.grinder')).toMatchObject({
      label: 'Grinder',
      before: 'C40',
      after: 'K6',
    });
    // The same name behind a different gear item is not a difference anyone can see
    const sameName = make({
      gear: {
        brewer: { item_id: '11111111-1111-4111-8111-111111111111', name: 'Hario V60 02' },
        grinder: { name: 'C40' },
      },
    });
    expect(keys(a, sameName)).toEqual([]);
  });

  it('reports a removed gear item as going to nothing', () => {
    const a = make({ gear: { grinder: { name: 'C40' } } });
    expect(diffVersions(a, make()).fields[0]).toMatchObject({ before: 'C40', after: null });
  });

  it('treats missing, null and empty values as the same', () => {
    const a = make();
    const b = { ...make(), coffee_name: null, notes: null };
    expect(diffVersions(a, b).count).toBe(0);
    expect(diffVersions({ ...a, coffee_name: '' as never }, a).count).toBe(0);
  });

  it('reports the recipe name and method (a custom method by its name)', () => {
    const d = diffVersions(
      make(),
      make({}, { name: 'Evening V60', method: 'other', method_custom: 'Tsubame' }),
    );
    expect(d.fields.map((f) => [f.key, f.before, f.after])).toEqual([
      ['basics.name', 'Morning V60', 'Evening V60'],
      ['basics.method', 'Pour-over', 'Tsubame'],
    ]);
    expect(d.sections.basics.count).toBe(2);
    expect(
      diffVersions(
        make({}, { method: 'other', method_custom: 'A' }),
        make({}, { method: 'other', method_custom: 'B' }),
      ).count,
    ).toBe(1);
  });

  it('is unit-independent: the values are metric, so the same diff comes out for any display unit', () => {
    const d = diffVersions(make(), make({ temp_c: 92, dose_g: 15.5 }));
    expect(d.fields.map((f) => [f.key, f.before, f.after])).toEqual([
      ['numbers.dose_g', 15, 15.5],
      ['numbers.temp_c', 93, 92],
    ]);
  });

  it('counts a field once whatever its section order', () => {
    const d = diffVersions(make(), make({ notes: 'x', dose_g: 20, roaster: 'y' }));
    expect(d.count).toBe(3);
    expect(d.fields.map((f) => f.section)).toEqual(['coffee', 'numbers', 'notes']);
  });
});

describe('diffVersions: steps', () => {
  // Not parsed: moved steps are deliberately out of time order, which the schema would reject.
  const withSteps = (list: StepData[]): DiffInput => ({ ...make(), steps: list });

  it('reports no step changes for identical steps', () => {
    expect(diffVersions(withSteps(steps), withSteps(steps.map((s) => ({ ...s })))).steps).toEqual(
      [],
    );
  });

  it('finds an added step, named from the newer version', () => {
    const added: StepData = { id: 's5', kind: 'wait', at_s: 100, duration_s: 20 };
    const d = diffVersions(withSteps(steps), withSteps([...steps, added]));
    expect(d.steps).toHaveLength(1);
    expect(d.steps[0]).toMatchObject({
      id: 's5',
      change: 'added',
      label: 'Wait',
      fromPosition: null,
      toPosition: 5,
      moved: false,
    });
    expect(d.sections.steps).toEqual({ changed: true, count: 1 });
    expect(d.count).toBe(1);
  });

  it('finds a removed step, named from the older version', () => {
    const d = diffVersions(withSteps(steps), withSteps(steps.filter((s) => s.id !== 's3')));
    expect(d.steps).toHaveLength(1);
    expect(d.steps[0]).toMatchObject({
      id: 's3',
      change: 'removed',
      label: 'Pour 2',
      fromPosition: 3,
      toPosition: null,
    });
  });

  it('finds a changed pour with field-level changes ("Pour 2: 100 g → 110 g")', () => {
    const next = steps.map((s) => (s.id === 's3' ? { ...s, target_g: 110 } : s));
    const d = diffVersions(withSteps(steps), withSteps(next));
    expect(d.steps).toHaveLength(1);
    expect(d.steps[0]).toMatchObject({
      id: 's3',
      change: 'changed',
      label: 'Pour 2',
      moved: false,
    });
    expect(d.steps[0]!.fields).toEqual([
      { key: 'target_g', label: 'Weight', type: 'weight', before: 100, after: 110 },
    ]);
  });

  it('finds every kind of field change on a step', () => {
    const before: StepData[] = [
      { id: 'x', kind: 'other', at_s: 0, label: 'Close valve', technique: 'gently' },
    ];
    const after: StepData[] = [{ id: 'x', kind: 'wait', at_s: 5, duration_s: 20 }];
    const [change] = diffVersions(withSteps(before), withSteps(after)).steps;
    expect(change!.fields.map((f) => f.key).sort()).toEqual([
      'at_s',
      'duration_s',
      'kind',
      'label',
      'technique',
    ]);
  });

  it('treats a cleared optional step field as a change to nothing', () => {
    const a = [{ ...steps[0]!, temp_c: 93 }];
    const b = [{ ...steps[0]!, temp_c: null }];
    expect(diffVersions(withSteps(a), withSteps(b)).steps[0]!.fields).toEqual([
      { key: 'temp_c', label: 'Temperature', type: 'temperature', before: 93, after: null },
    ]);
  });

  it('finds a moved step by its id, and only that step', () => {
    const next = [steps[1]!, steps[2]!, steps[3]!, steps[0]!]; // the bloom pour now last
    const d = diffVersions(withSteps(steps), withSteps(next));
    expect(d.steps.map((s) => [s.id, s.change])).toEqual([['s1', 'moved']]);
    expect(d.steps[0]).toMatchObject({ fromPosition: 1, toPosition: 4, moved: true, fields: [] });
  });

  it('swapping two neighbours reports exactly one of them as moved', () => {
    const next = [steps[1]!, steps[0]!, steps[2]!, steps[3]!];
    const d = diffVersions(withSteps(steps), withSteps(next));
    expect(d.steps).toHaveLength(1);
    expect(['s1', 's2']).toContain(d.steps[0]!.id);
    expect(d.steps[0]).toMatchObject({ change: 'moved', moved: true });
  });

  it('moving the last step to the front marks only that step as moved', () => {
    const next = [steps[3]!, steps[0]!, steps[1]!, steps[2]!];
    const d = diffVersions(withSteps(steps), withSteps(next));
    expect(d.steps.map((s) => [s.id, s.change, s.moved])).toEqual([['s4', 'moved', true]]);
  });

  it('a step that moved and changed is reported as changed, and flagged as moved', () => {
    const next = [steps[1]!, steps[2]!, steps[3]!, { ...steps[0]!, duration_s: 8 }];
    const d = diffVersions(withSteps(steps), withSteps(next));
    expect(d.steps).toHaveLength(1);
    expect(d.steps[0]).toMatchObject({ id: 's1', change: 'changed', moved: true });
    expect(d.steps[0]!.fields.map((f) => f.key)).toEqual(['duration_s']);
  });

  it('matches steps by id, not position: a new step in the middle does not "change" the rest', () => {
    const inserted: StepData = { id: 'new', kind: 'stir', at_s: 20, duration_s: 5 };
    const next = [steps[0]!, steps[1]!, inserted, steps[2]!, steps[3]!];
    const d = diffVersions(withSteps(steps), withSteps(next));
    expect(d.steps.map((s) => [s.id, s.change])).toEqual([['new', 'added']]);
  });

  it('reports everything together, added first in the new order then removed', () => {
    const next = [
      steps[0]!,
      { ...steps[2]!, target_g: 120 },
      { id: 'n', kind: 'press', at_s: 100, duration_s: 30 } as StepData,
    ];
    const d = diffVersions(withSteps(steps), withSteps(next));
    expect(d.steps.map((s) => [s.id, s.change])).toEqual([
      ['s3', 'changed'],
      ['n', 'added'],
      ['s2', 'removed'],
      ['s4', 'removed'],
    ]);
  });

  it('handles no steps on either side', () => {
    expect(diffVersions(withSteps([]), withSteps([])).steps).toEqual([]);
    expect(diffVersions(withSteps([]), withSteps(steps)).steps).toHaveLength(4);
    expect(
      diffVersions(withSteps(steps), withSteps([])).steps.every((s) => s.change === 'removed'),
    ).toBe(true);
  });

  it('a version that starts from another keeps step ids, so only real edits show', () => {
    const next = steps.map((s) => ({ ...s }));
    next[2]!.at_s = 50;
    const d = diffVersions(withSteps(steps), withSteps(next));
    expect(d.steps).toHaveLength(1);
    expect(d.steps[0]!.fields).toEqual([
      { key: 'at_s', label: 'Time', type: 'duration', before: 45, after: 50 },
    ]);
  });
});

describe('versionDiffInput', () => {
  it('normalises a stored row the same way as the form, so a saved version matches itself', () => {
    const row = {
      id: 'ignored',
      recipe_id: 'ignored',
      version_no: 3,
      dose_g: 15,
      brew_water_g: 250,
      bypass_g: 0,
      bypass_timing: 'none',
      temp_c: 93,
      coffee_name: null,
      steps: [{ id: 's1', kind: 'pour', at_s: 0, target_g: 30, rate_gps: null }],
      gear: {},
      notes: null,
    };
    const recipe = { name: 'Morning V60', method: 'pour_over' as const, method_custom: null };
    const fromRow = versionDiffInput(recipe, row);
    expect(fromRow.steps).toEqual([{ id: 's1', kind: 'pour', at_s: 0, target_g: 30 }]);
    expect(
      diffVersions(fromRow, make({ steps: [{ id: 's1', kind: 'pour', at_s: 0, target_g: 30 }] }))
        .count,
    ).toBe(0);
    expect(diffVersions(fromRow, versionDiffInput(recipe, { ...row, temp_c: 92 })).count).toBe(1);
  });
});
