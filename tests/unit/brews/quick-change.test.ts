import { describe, expect, it } from 'vitest';
import {
  applyQuickChange,
  changedFields,
  isNoChange,
  normalizeGrind,
  normalizeQuickChange,
} from '@/lib/brews/quick-change';
import { changeNote, changeSummary, describeChanges, CHANGE_NOTE_MAX } from '@/lib/brews/change-note';
import { weightToDisplay } from '@/lib/units';
import type { StepData } from '@/lib/recipes/steps';
import { IMPERIAL, METRIC, V60, freeze } from './fixtures';

const targets = (steps: readonly StepData[]) =>
  steps.filter((s) => s.kind === 'pour').map((s) => s.target_g);
const temps = (steps: readonly StepData[]) => steps.map((s) => s.temp_c ?? null);

describe('applyQuickChange: brew water', () => {
  it('scales every pour by new ÷ old to whole grams and makes the last pour exactly the new water', () => {
    const out = applyQuickChange(freeze(V60), { brewWaterG: 275 });
    expect(out.brew_water_g).toBe(275);
    expect(targets(out.steps)).toEqual([33, 110, 187, 275]);
  });

  it('scales down too', () => {
    const out = applyQuickChange(V60, { brewWaterG: 200 });
    expect(targets(out.steps)).toEqual([24, 80, 136, 200]);
  });

  it('keeps a fractional new brew water exact on the last pour and rounds the others', () => {
    const out = applyQuickChange(V60, { brewWaterG: 255.5 });
    expect(out.brew_water_g).toBe(255.5);
    expect(targets(out.steps)).toEqual([31, 102, 174, 255.5]);
  });

  it('rounds a last pour that did not reach the old water like any other', () => {
    const steps: StepData[] = [
      { id: 'a', kind: 'pour', at_s: 0, target_g: 40 },
      { id: 'b', kind: 'pour', at_s: 30, target_g: 240 },
    ];
    const out = applyQuickChange({ ...V60, steps }, { brewWaterG: 275 });
    expect(targets(out.steps)).toEqual([44, 264]);
  });

  it('keeps pours rising and above zero when rounding would flatten them', () => {
    const steps: StepData[] = [
      { id: 'a', kind: 'pour', at_s: 0, target_g: 2 },
      { id: 'b', kind: 'pour', at_s: 10, target_g: 3 },
      { id: 'c', kind: 'pour', at_s: 20, target_g: 250 },
    ];
    const out = applyQuickChange({ ...V60, steps }, { brewWaterG: 100 });
    expect(targets(out.steps)).toEqual([1, 2, 100]);
  });

  it('leaves times, durations, techniques and other steps alone', () => {
    const out = applyQuickChange(V60, { brewWaterG: 275 });
    expect(out.steps.map((s) => [s.id, s.kind, s.at_s, s.duration_s ?? null, s.technique ?? null])).toEqual(
      V60.steps.map((s) => [s.id, s.kind, s.at_s, s.duration_s ?? null, s.technique ?? null]),
    );
  });

  it('does not touch dose, temperature or grind', () => {
    const out = applyQuickChange(V60, { brewWaterG: 275 });
    expect([out.dose_g, out.temp_c, out.grind_setting]).toEqual([15, 93, '18']);
    expect(temps(out.steps)).toEqual(temps(V60.steps));
  });
});

describe('applyQuickChange: temperature', () => {
  it('sets the temperature and shifts every per-pour temperature by the same difference', () => {
    const out = applyQuickChange(V60, { tempC: 94 });
    expect(out.temp_c).toBe(94);
    expect(temps(out.steps)).toEqual([94, null, 94, 94, null, 94]);
  });

  it('keeps the spread between pours', () => {
    const steps: StepData[] = [
      { id: 'a', kind: 'pour', at_s: 0, target_g: 50, temp_c: 96 },
      { id: 'b', kind: 'pour', at_s: 30, target_g: 250, temp_c: 90 },
    ];
    const out = applyQuickChange({ ...V60, steps }, { tempC: 91 });
    expect(temps(out.steps)).toEqual([94, 88]);
  });

  it('clamps per-pour temperatures to 0–100', () => {
    const hot: StepData[] = [{ id: 'a', kind: 'pour', at_s: 0, target_g: 250, temp_c: 99 }];
    expect(temps(applyQuickChange({ ...V60, temp_c: 98, steps: hot }, { tempC: 100 }).steps)).toEqual([100]);
    const cold: StepData[] = [{ id: 'a', kind: 'pour', at_s: 0, target_g: 250, temp_c: 3 }];
    expect(temps(applyQuickChange({ ...V60, temp_c: 10, steps: cold }, { tempC: 0 }).steps)).toEqual([0]);
  });

  it('does not shift anything when there was no temperature before or it is cleared', () => {
    const none = applyQuickChange({ ...V60, temp_c: null }, { tempC: 94 });
    expect(none.temp_c).toBe(94);
    expect(temps(none.steps)).toEqual(temps(V60.steps));
    const cleared = applyQuickChange(V60, { tempC: null });
    expect(cleared.temp_c).toBeNull();
    expect(temps(cleared.steps)).toEqual(temps(V60.steps));
  });

  it('avoids float noise on one-decimal temperatures', () => {
    const steps: StepData[] = [{ id: 'a', kind: 'pour', at_s: 0, target_g: 250, temp_c: 92.3 }];
    const out = applyQuickChange({ ...V60, temp_c: 92.3, steps }, { tempC: 93.4 });
    expect(temps(out.steps)).toEqual([93.4]);
  });
});

describe('applyQuickChange: dose and grind', () => {
  it('changes only the dose and keeps the very same steps', () => {
    const out = applyQuickChange(V60, { doseG: 16 });
    expect(out.dose_g).toBe(16);
    expect(out.brew_water_g).toBe(250);
    expect(out.steps).toBe(V60.steps);
  });

  it('changes only the grind, trimmed, and an empty grind clears it', () => {
    expect(applyQuickChange(V60, { grindSetting: ' 17 ' }).grind_setting).toBe('17');
    expect(applyQuickChange(V60, { grindSetting: '' }).grind_setting).toBeNull();
    expect(applyQuickChange(V60, { grindSetting: '17' }).steps).toBe(V60.steps);
  });

  it('keeps bypass, other fields and never mutates the version', () => {
    const base = freeze({ ...V60, bypass_g: 50 });
    const out = applyQuickChange(base, { doseG: 16, brewWaterG: 275, tempC: 94, grindSetting: '17' });
    expect(out.bypass_g).toBe(50);
    expect(out.name).toBe('V60 everyday');
    expect(base.dose_g).toBe(15);
    expect(base.steps[0]!.target_g).toBe(30);
  });
});

describe('no-op detection', () => {
  it('returns the same version when nothing changes', () => {
    expect(applyQuickChange(V60, null)).toBe(V60);
    expect(applyQuickChange(V60, {})).toBe(V60);
    expect(applyQuickChange(V60, { doseG: 15, brewWaterG: 250, tempC: 93, grindSetting: '18' })).toBe(V60);
    expect(applyQuickChange(V60, { doseG: undefined, tempC: undefined })).toBe(V60);
  });

  it('treats a value put back to the original as no change', () => {
    expect(isNoChange(V60, { grindSetting: '18', tempC: 93.04 })).toBe(true);
    expect(isNoChange(V60, null)).toBe(true);
    expect(isNoChange(V60, { doseG: 15.1 })).toBe(false);
    expect(normalizeQuickChange(V60, { grindSetting: '17', tempC: 93, doseG: 15 })).toEqual({ grindSetting: '17' });
  });

  it('knows a missing grind or temperature equals an empty one', () => {
    const base = { ...V60, grind_setting: null, temp_c: null };
    expect(isNoChange(base, { grindSetting: '', tempC: null })).toBe(true);
    expect(isNoChange(base, { grindSetting: '17' })).toBe(false);
    expect(isNoChange(base, { tempC: 93 })).toBe(false);
    expect(normalizeGrind('   ')).toBeNull();
  });

  it('lists the changed fields in a fixed order', () => {
    expect(changedFields(V60, { brewWaterG: 260, doseG: 16, tempC: 94, grindSetting: '17' })).toEqual([
      { field: 'grind', from: '18', to: '17' },
      { field: 'temp', from: 93, to: 94 },
      { field: 'dose', from: 15, to: 16 },
      { field: 'water', from: 250, to: 260 },
    ]);
    expect(changedFields(V60, null)).toEqual([]);
  });
});

describe('change note', () => {
  it('reads like the prompt in metric', () => {
    expect(changeNote(V60, { grindSetting: '17', tempC: 94 }, METRIC)).toBe(
      'Brewed with changes: grind 18 → 17, 93 → 94 °C',
    );
    expect(changeSummary(V60, { grindSetting: '17', tempC: 94 }, METRIC)).toBe('Grind 18 → 17 · 93 → 94 °C');
  });

  it('shows temperatures in °F and weights in oz, from the stored metric values', () => {
    expect(changeNote(V60, { tempC: 94 }, IMPERIAL)).toBe('Brewed with changes: 199.4 → 201.2 °F');
    const note = changeNote(V60, { doseG: 16, brewWaterG: 275 }, IMPERIAL);
    expect(note).toBe(
      `Brewed with changes: dose ${weightToDisplay(15, 'oz')} → ${weightToDisplay(16, 'oz')} oz, ` +
        `water ${weightToDisplay(250, 'oz')} → ${weightToDisplay(275, 'oz')} oz`,
    );
  });

  it('lists dose and water in grams', () => {
    expect(describeChanges(V60, { doseG: 16, brewWaterG: 275 }, METRIC)).toEqual([
      'dose 15 → 16 g',
      'water 250 → 275 g',
    ]);
  });

  it('shows a dash for an unset grind or temperature', () => {
    const base = { ...V60, grind_setting: null, temp_c: null };
    expect(describeChanges(base, { grindSetting: '17', tempC: 94 }, METRIC)).toEqual([
      'grind — → 17',
      '— → 94 °C',
    ]);
  });

  it('is empty when nothing changed', () => {
    expect(changeNote(V60, { grindSetting: '18' }, METRIC)).toBe('');
    expect(changeNote(V60, null, METRIC)).toBe('');
    expect(changeSummary(V60, null, METRIC)).toBe('');
  });

  it('never goes over the database limit, even with the longest grind text and every field changed', () => {
    const grind = 'x'.repeat(40);
    const base = { ...V60, grind_setting: grind, dose_g: 199.9, brew_water_g: 2999.9, temp_c: 99.9 };
    const note = changeNote(
      base,
      { grindSetting: 'y'.repeat(40), tempC: 0.1, doseG: 0.1, brewWaterG: 0.1 },
      IMPERIAL,
    );
    expect(note.length).toBeGreaterThan(0);
    expect(note.length).toBeLessThanOrEqual(CHANGE_NOTE_MAX);
  });
});
