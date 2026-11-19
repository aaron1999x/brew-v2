import { afterEach, describe, expect, it } from 'vitest';
import {
  DEVICE_DRAFT_KEY,
  STEPS_ADD_ID,
  clearDeviceDraft,
  draftSignature,
  emptyDraft,
  fieldId,
  loadDeviceDraft,
  parseDraft,
  saveDeviceDraft,
  stepFieldId,
  type RecipeDraft,
} from '@/lib/recipes/draft';
import type { GearItem } from '@/lib/recipes/gear';
import type { StepData } from '@/lib/recipes/steps';

const filled = (over: Partial<RecipeDraft> = {}): RecipeDraft => ({
  ...emptyDraft(),
  name: 'Morning V60',
  method: 'pour_over',
  dose_g: 15,
  brew_water_g: 250,
  ...over,
});

const item = (over: Partial<GearItem>): GearItem => ({
  id: 'g1',
  category: 'brewer',
  catalog_id: null,
  custom_name: 'My V60',
  nickname: null,
  notes: null,
  is_default: false,
  catalog: null,
  ...over,
});

function errorsOf(draft: RecipeDraft) {
  const parsed = parseDraft(draft);
  return parsed.ok ? [] : parsed.errors;
}

describe('emptyDraft', () => {
  it('starts with my default in each category and nothing else', () => {
    const draft = emptyDraft([
      item({ id: 'a', category: 'brewer', is_default: true }),
      item({ id: 'b', category: 'brewer' }),
      item({ id: 'c', category: 'grinder' }),
    ]);
    expect(draft.gear.brewer).toMatchObject({ kind: 'item', item: { id: 'a' } });
    expect(draft.gear.grinder).toBeUndefined();
    expect(draft.method).toBeNull();
    expect(draft.steps).toEqual([]);
  });
});

describe('parseDraft', () => {
  it('names the four required fields when nothing is filled in', () => {
    expect(errorsOf(emptyDraft()).map((e) => e.fieldId)).toEqual([
      fieldId('name'),
      fieldId('method'),
      fieldId('dose_g'),
      fieldId('brew_water_g'),
    ]);
    expect(fieldId('brew_water_g')).toBe('recipe-brew-water-g');
  });

  it('accepts the minimum and normalises it', () => {
    const parsed = parseDraft(filled({ name: '  Morning V60  ', coffee_name: '   ' }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.values.name).toBe('Morning V60');
    expect(parsed.values.version.coffee_name).toBeNull();
    expect(parsed.values.version.bypass_g).toBe(0);
    expect(parsed.values.version.steps).toEqual([]);
  });

  it('asks for the method name when the method is Other', () => {
    expect(errorsOf(filled({ method: 'other' }))).toEqual([
      { fieldId: fieldId('method_custom'), message: 'Name the method' },
    ]);
  });

  it('puts the bypass timing error on the timing field', () => {
    expect(errorsOf(filled({ bypass_g: 20 })).map((e) => e.fieldId)).toEqual([
      fieldId('bypass_timing'),
    ]);
  });

  it('points step errors at the step and its field', () => {
    const steps: StepData[] = [
      { id: 's1', kind: 'pour', at_s: 0, target_g: 50 },
      { id: 's2', kind: 'pour', at_s: 30, target_g: 40 },
      { id: 's3', kind: 'other', at_s: 60, label: '' },
    ];
    // Order is the editor's job (it sorts by position on the page); here: exactly these two.
    expect(errorsOf(filled({ steps })).map((e) => e.fieldId).sort()).toEqual(
      [stepFieldId('s2', 'target_g'), stepFieldId('s3', 'label')].sort(),
    );
  });

  it('points a pour with no weight at its weight field', () => {
    const steps: StepData[] = [{ id: 'p', kind: 'pour', at_s: 0, target_g: null }];
    expect(errorsOf(filled({ steps }))).toEqual([
      { fieldId: stepFieldId('p', 'target_g'), message: 'Enter the weight for this pour' },
    ]);
  });

  it('keeps one error per field', () => {
    const steps: StepData[] = [
      { id: 'a', kind: 'wait', at_s: 100 },
      { id: 'b', kind: 'wait', at_s: 10 },
    ];
    const ids = errorsOf(filled({ steps })).map((e) => e.fieldId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([stepFieldId('b', 'at_s')]);
  });

  it('drops pour temperatures while "vary temperature by pour" is off', () => {
    const steps: StepData[] = [{ id: 'p', kind: 'pour', at_s: 0, target_g: 50, temp_c: 93 }];
    const off = parseDraft(filled({ steps, vary_temp: false }));
    const on = parseDraft(filled({ steps, vary_temp: true }));
    expect(off.ok && off.values.version.steps[0]).not.toHaveProperty('temp_c');
    expect(on.ok && on.values.version.steps[0]).toHaveProperty('temp_c', 93);
  });

  it('keeps long times as whole seconds (a 12-hour steep)', () => {
    const steps: StepData[] = [{ id: 'w', kind: 'wait', at_s: 0, duration_s: 43_200 }];
    const parsed = parseDraft(filled({ method: 'cold_brew', steps }));
    expect(parsed.ok && parsed.values.version.steps[0]).toMatchObject({ duration_s: 43_200 });
  });

  it('has an id for the steps-level error', () => {
    expect(STEPS_ADD_ID).toBe('steps-add');
  });
});

describe('draftSignature', () => {
  it('changes when anything in the draft changes', () => {
    const a = emptyDraft();
    expect(draftSignature(a)).toBe(draftSignature(emptyDraft()));
    expect(draftSignature({ ...a, notes: 'x' })).not.toBe(draftSignature(a));
  });
});

describe('the copy kept on this device', () => {
  afterEach(() => window.localStorage.clear());

  it('saves, loads and clears a draft', () => {
    const draft = filled({ notes: 'finer next time' });
    saveDeviceDraft(draft);
    expect(loadDeviceDraft()).toEqual(draft);
    clearDeviceDraft();
    expect(loadDeviceDraft()).toBeNull();
  });

  it('fills in fields an older draft lacks', () => {
    window.localStorage.setItem(
      DEVICE_DRAFT_KEY,
      JSON.stringify({ draft: { name: 'Old', steps: [] } }),
    );
    expect(loadDeviceDraft()).toMatchObject({ name: 'Old', bypass_timing: 'none', gear: {} });
  });

  it('ignores damaged data', () => {
    window.localStorage.setItem(DEVICE_DRAFT_KEY, '{not json');
    expect(loadDeviceDraft()).toBeNull();
    window.localStorage.setItem(DEVICE_DRAFT_KEY, JSON.stringify({ draft: 'x' }));
    expect(loadDeviceDraft()).toBeNull();
  });
});
