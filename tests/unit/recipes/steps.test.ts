import { describe, expect, it } from 'vitest';
import {
  MAX_STEPS,
  bloom,
  clearPourTemperatures,
  curvePoints,
  defaultNewStep,
  defaultPourTarget,
  defaultStepTime,
  hasPourTemperatures,
  insertStep,
  lastPourWarning,
  lastPourWarningMessage,
  moveStep,
  pourDeltas,
  pourTemperatureTrail,
  removeStep,
  setVaryTemperature,
  sortStepsByTime,
  stepHeading,
  stepLabel,
  totalTimeS,
  validateSteps,
  type StepData,
} from '@/lib/recipes/steps';

const ctx = { dose_g: 15, brew_water_g: 250 };
const pour = (
  id: string,
  at_s: number,
  target_g: number,
  extra: Partial<StepData> = {},
): StepData => ({
  id,
  kind: 'pour',
  at_s,
  target_g,
  ...extra,
});

describe('step defaults', () => {
  it('starts the first step at 0:00', () => {
    expect(defaultStepTime([])).toBe(0);
  });

  it('starts a step 30 s after a pour', () => {
    expect(defaultStepTime([pour('a', 10, 30)])).toBe(40);
  });

  it("starts a step when the previous step's duration ends", () => {
    expect(defaultStepTime([{ id: 'a', kind: 'wait', at_s: 40, duration_s: 20 }])).toBe(60);
    expect(defaultStepTime([{ id: 'a', kind: 'swirl', at_s: 40 }])).toBe(40);
    expect(
      defaultStepTime([{ id: 'a', kind: 'other', at_s: 100, label: 'Flip', duration_s: null }]),
    ).toBe(100);
  });

  it('never defaults beyond 48 hours', () => {
    expect(defaultStepTime([{ id: 'a', kind: 'wait', at_s: 172_000, duration_s: 5000 }])).toBe(
      172_800,
    );
  });

  it('makes the first pour 2 × dose (the bloom)', () => {
    expect(defaultPourTarget([], ctx)).toBe(30);
    expect(defaultPourTarget([], { dose_g: 18.5, brew_water_g: 300 })).toBe(37);
  });

  it('keeps the first pour within the brew water', () => {
    expect(defaultPourTarget([], { dose_g: 15, brew_water_g: 20 })).toBe(20);
  });

  it('has no first-pour default without a dose', () => {
    expect(defaultPourTarget([], { dose_g: null, brew_water_g: 250 })).toBeNull();
    expect(defaultPourTarget([], { dose_g: 0, brew_water_g: 250 })).toBeNull();
  });

  it('goes half-way from the last pour to brew water, rounded to 5 g', () => {
    expect(defaultPourTarget([pour('a', 0, 30)], ctx)).toBe(140);
    expect(defaultPourTarget([pour('a', 0, 140)], ctx)).toBe(195);
    expect(defaultPourTarget([pour('a', 0, 195)], ctx)).toBe(225);
    expect(defaultPourTarget([pour('a', 0, 245)], ctx)).toBe(250);
  });

  it('always rises above the last pour, even at or past the brew water', () => {
    expect(defaultPourTarget([pour('a', 0, 250)], ctx)).toBe(255);
    expect(defaultPourTarget([pour('a', 0, 300)], ctx)).toBe(305);
  });

  it('bases the next pour on the last pour, not the last step', () => {
    const steps: StepData[] = [
      pour('a', 0, 30),
      { id: 'b', kind: 'swirl', at_s: 10, duration_s: 5 },
    ];
    expect(defaultPourTarget(steps, ctx)).toBe(140);
  });

  it('steps up by 100 g when there is no brew water yet', () => {
    expect(defaultPourTarget([pour('a', 0, 30)], { dose_g: 15, brew_water_g: null })).toBe(80);
  });

  it('builds a new step of each kind with its defaults', () => {
    const first = defaultNewStep('pour', [], ctx, 'p1');
    expect(first).toEqual({ id: 'p1', kind: 'pour', at_s: 0, target_g: 30 });
    const steps = [first];
    expect(defaultNewStep('swirl', steps, ctx, 's1')).toEqual({
      id: 's1',
      kind: 'swirl',
      at_s: 30,
      duration_s: 5,
    });
    expect(defaultNewStep('wait', steps, ctx, 'w1')).toMatchObject({
      kind: 'wait',
      at_s: 30,
      duration_s: 30,
    });
    expect(defaultNewStep('stir', steps, ctx, 'i1')).toMatchObject({ kind: 'stir', duration_s: 5 });
    expect(defaultNewStep('press', steps, ctx, 'r1')).toMatchObject({
      kind: 'press',
      duration_s: 30,
    });
    expect(defaultNewStep('other', steps, ctx, 'o1')).toEqual({
      id: 'o1',
      kind: 'other',
      at_s: 30,
      label: '',
    });
  });

  it('gives a new step a fresh id by default', () => {
    const a = defaultNewStep('wait', [], ctx);
    const b = defaultNewStep('wait', [], ctx);
    expect(a.id).not.toBe(b.id);
    expect(a.id.length).toBeGreaterThan(10);
  });

  it('allows 30 steps', () => {
    expect(MAX_STEPS).toBe(30);
  });
});

describe('validateSteps', () => {
  it('accepts an ordered recipe, including equal times', () => {
    const steps: StepData[] = [
      { id: 'a', kind: 'other', at_s: 0, label: 'Close valve' },
      pour('b', 0, 240),
      { id: 'c', kind: 'stir', at_s: 25, duration_s: 5 },
    ];
    expect(validateSteps(steps)).toEqual([]);
  });

  it('accepts no steps', () => {
    expect(validateSteps([])).toEqual([]);
  });

  it('flags a step that starts before the step above it', () => {
    const issues = validateSteps([pour('a', 0, 30), pour('b', 45, 150), pour('c', 30, 250)]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      index: 2,
      stepId: 'c',
      code: 'out_of_order',
      field: 'at_s',
      message: 'Step 3 starts before step 2',
    });
  });

  it('flags a pour that is not higher than the previous pour', () => {
    const issues = validateSteps([
      pour('a', 0, 100),
      { id: 'w', kind: 'wait', at_s: 10 },
      pour('b', 30, 100),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ index: 2, code: 'pour_not_rising', field: 'target_g' });
    expect(issues[0]!.message).toContain('step 1');
    expect(validateSteps([pour('a', 0, 100), pour('b', 30, 90)])).toHaveLength(1);
  });

  it('compares each pour with the pour before it, skipping other steps', () => {
    expect(
      validateSteps([pour('a', 0, 30), { id: 'x', kind: 'swirl', at_s: 5 }, pour('b', 30, 31)]),
    ).toEqual([]);
  });

  it('ignores a pour with no weight yet (the field reports it)', () => {
    expect(
      validateSteps([pour('a', 0, 30), { id: 'b', kind: 'pour', at_s: 30, target_g: null }]),
    ).toEqual([]);
  });

  it('requires a label on other steps', () => {
    const issues = validateSteps([{ id: 'a', kind: 'other', at_s: 0, label: '   ' }]);
    expect(issues).toEqual([
      {
        index: 0,
        stepId: 'a',
        code: 'label_required',
        field: 'label',
        message: 'Step 1 needs a label',
      },
    ]);
    expect(validateSteps([{ id: 'a', kind: 'other', at_s: 0, label: null }])).toHaveLength(1);
  });

  it('reports every problem', () => {
    const issues = validateSteps([
      pour('a', 50, 100),
      pour('b', 10, 90),
      { id: 'c', kind: 'other', at_s: 5, label: '' },
    ]);
    expect(issues.map((i) => i.code).sort()).toEqual([
      'label_required',
      'out_of_order',
      'out_of_order',
      'pour_not_rising',
    ]);
  });
});

describe('lastPourWarning', () => {
  it('warns (not an error) when the last pour is not the brew water', () => {
    const w = lastPourWarning([pour('a', 0, 30), pour('b', 45, 240)], 250);
    expect(w).toEqual({ code: 'last_pour_not_brew_water', lastPourG: 240, brewWaterG: 250 });
    expect(lastPourWarningMessage(w!, (g) => `${g} g`)).toBe(
      'Your last pour reaches 240 g; brew water is 250 g',
    );
  });

  it('is quiet when the last pour reaches the brew water', () => {
    expect(lastPourWarning([pour('a', 0, 250)], 250)).toBeNull();
    expect(lastPourWarning([pour('a', 0, 250.02)], 250)).toBeNull();
  });

  it('is quiet with no pours or no brew water', () => {
    expect(lastPourWarning([], 250)).toBeNull();
    expect(lastPourWarning([{ id: 'w', kind: 'wait', at_s: 0 }], 250)).toBeNull();
    expect(lastPourWarning([pour('a', 0, 100)], null)).toBeNull();
  });

  it('looks at the last pour, not the last step', () => {
    expect(
      lastPourWarning([pour('a', 0, 250), { id: 'p', kind: 'press', at_s: 60 }], 250),
    ).toBeNull();
  });
});

describe('editing helpers', () => {
  const steps: StepData[] = [pour('a', 30, 30), pour('b', 0, 100), pour('c', 30, 200)];

  it('sorts by time and keeps the order of steps at the same time', () => {
    expect(sortStepsByTime(steps).map((s) => s.id)).toEqual(['b', 'a', 'c']);
    expect(steps.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('moves a step up and down without changing the original', () => {
    expect(moveStep(steps, 1, 'up').map((s) => s.id)).toEqual(['b', 'a', 'c']);
    expect(moveStep(steps, 1, 'down').map((s) => s.id)).toEqual(['a', 'c', 'b']);
    expect(steps.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('leaves the order alone at the edges and for a bad index', () => {
    expect(moveStep(steps, 0, 'up').map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(moveStep(steps, 2, 'down').map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(moveStep(steps, 7, 'up').map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('removes a step and puts it back where it was', () => {
    const { steps: rest, removed } = removeStep(steps, 1);
    expect(rest.map((s) => s.id)).toEqual(['a', 'c']);
    expect(removed?.id).toBe('b');
    expect(insertStep(rest, 1, removed!).map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(removeStep(steps, 9)).toEqual({ steps, removed: null });
    expect(insertStep(rest, 99, removed!).map((s) => s.id)).toEqual(['a', 'c', 'b']);
  });

  it('knows when pours have temperatures and clears them', () => {
    expect(hasPourTemperatures(steps)).toBe(false);
    const warm = [pour('a', 0, 30, { temp_c: 93 }), pour('b', 30, 100, { temp_c: null })];
    expect(hasPourTemperatures(warm)).toBe(true);
    const cleared = clearPourTemperatures(warm);
    expect(hasPourTemperatures(cleared)).toBe(false);
    expect(cleared[1]).toBe(warm[1]);
    expect(warm[0]!.temp_c).toBe(93);
  });
});

describe('Vary temperature by pour', () => {
  const steps: StepData[] = [
    pour('a', 0, 40),
    { id: 's', kind: 'swirl', at_s: 10, duration_s: 5 },
    pour('b', 30, 100, { temp_c: 95 }),
    pour('c', 60, 160, { temp_c: 95 }),
    pour('d', 90, 250, { temp_c: 90 }),
  ];

  it('turning it on starts every pour without a temperature at the recipe temperature (as the prototype does)', () => {
    const out = setVaryTemperature(steps, true, 92);
    expect(out.filter((s) => s.kind === 'pour').map((s) => s.temp_c)).toEqual([92, 95, 95, 90]);
    expect(out[1]!.temp_c).toBeUndefined();
    expect(steps[0]!.temp_c).toBeUndefined();
  });

  it('turning it on with no recipe temperature leaves the pours as they are', () => {
    expect(setVaryTemperature(steps, true, null)).toEqual(steps);
  });

  it('turning it off drops every pour temperature', () => {
    const out = setVaryTemperature(steps, false, 92);
    expect(out.every((s) => s.temp_c == null)).toBe(true);
  });

  it('lists the pour temperatures in order, without repeats', () => {
    expect(pourTemperatureTrail(setVaryTemperature(steps, true, 92), 92)).toEqual([92, 95, 90]);
    expect(pourTemperatureTrail(steps, 93)).toEqual([93, 95, 90]);
    expect(pourTemperatureTrail([], 93)).toEqual([]);
    expect(pourTemperatureTrail(steps.slice(0, 1), null)).toEqual([]);
  });
});

describe('derived numbers', () => {
  const steps: StepData[] = [
    pour('a', 0, 30),
    { id: 'b', kind: 'swirl', at_s: 10, duration_s: 5 },
    pour('c', 45, 150),
    pour('d', 90, 250),
  ];

  it('gives "+X g this pour" from the previous pour (the first from 0)', () => {
    const deltas = pourDeltas(steps);
    expect(deltas.get('a')).toBe(30);
    expect(deltas.get('c')).toBe(120);
    expect(deltas.get('d')).toBe(100);
    expect(deltas.has('b')).toBe(false);
  });

  it('has no deltas without pours', () => {
    expect(pourDeltas([]).size).toBe(0);
    expect(pourDeltas([{ id: 'w', kind: 'wait', at_s: 0 }]).size).toBe(0);
  });

  it("totals the last step's time plus its duration", () => {
    expect(totalTimeS(steps)).toBe(90);
    expect(totalTimeS([...steps, { id: 'e', kind: 'press', at_s: 120, duration_s: 30 }])).toBe(150);
    expect(totalTimeS([{ id: 'w', kind: 'wait', at_s: 60, duration_s: 43_200 }])).toBe(43_260);
  });

  it('has no total time without steps, and a single step is its own total', () => {
    expect(totalTimeS([])).toBeNull();
    expect(totalTimeS([pour('a', 0, 30)])).toBe(0);
  });

  it('finds the bloom: the first pour and the time to the next step', () => {
    expect(bloom(steps)).toEqual({ amountG: 30, atS: 0, durationS: 10 });
    expect(
      bloom([
        { id: 'x', kind: 'other', at_s: 0, label: 'Close' },
        pour('a', 0, 240),
        { id: 'w', kind: 'wait', at_s: 25 },
      ]),
    ).toEqual({
      amountG: 240,
      atS: 0,
      durationS: 25,
    });
  });

  it('has no bloom without a pour, and no duration when the pour is the last step', () => {
    expect(bloom([])).toBeNull();
    expect(bloom([{ id: 'w', kind: 'wait', at_s: 0 }])).toBeNull();
    expect(bloom([pour('a', 0, 30)])).toEqual({ amountG: 30, atS: 0, durationS: null });
  });

  it('names steps: numbered when a kind repeats, by label for other', () => {
    expect(stepLabel(steps, 0)).toBe('Pour 1');
    expect(stepLabel(steps, 1)).toBe('Swirl');
    expect(stepLabel(steps, 3)).toBe('Pour 3');
    expect(stepLabel([{ id: 'o', kind: 'other', at_s: 0, label: 'Open valve' }], 0)).toBe(
      'Open valve',
    );
    expect(stepLabel([{ id: 'o', kind: 'other', at_s: 0, label: ' ' }], 0)).toBe('Other');
    expect(stepLabel(steps, 9)).toBe('');
  });

  it('builds the card heading and its accessible name', () => {
    expect(stepHeading(steps, 2)).toEqual({
      visible: 'Step 3 · Pour · 0:45',
      accessible: 'Step 3, pour, 0:45',
    });
    expect(stepHeading([{ id: 'w', kind: 'wait', at_s: 43_260 }], 0).visible).toBe(
      'Step 1 · Wait · 12:01:00',
    );
    expect(stepHeading(steps, 9)).toEqual({ visible: '', accessible: '' });
  });
});

describe('curvePoints', () => {
  it('carries the water level through non-pour steps', () => {
    const points = curvePoints([
      { id: 'a', kind: 'swirl', at_s: 0, duration_s: 3 },
      pour('b', 5, 30),
      { id: 'c', kind: 'wait', at_s: 10, duration_s: 35 },
      pour('d', 45, 250),
    ]);
    expect(points.map((p) => [p.stepId, p.t_s, p.level_g, p.isPour, p.end_s])).toEqual([
      ['a', 0, 0, false, 3],
      ['b', 5, 30, true, 5],
      ['c', 10, 30, false, 45],
      ['d', 45, 250, true, 45],
    ]);
    expect(points[1]!.label).toBe('Pour 1');
    expect(points[2]!.label).toBe('Wait');
  });

  it('is empty without steps', () => {
    expect(curvePoints([])).toEqual([]);
  });

  it('does not move the level for a pour with no weight yet', () => {
    const [p] = curvePoints([{ id: 'a', kind: 'pour', at_s: 0, target_g: null }]);
    expect(p).toMatchObject({ level_g: 0, isPour: false });
  });
});
