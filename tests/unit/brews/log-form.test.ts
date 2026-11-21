import { describe, expect, it } from 'vitest';
import { extractionModel, NO_TARGETS } from '@/lib/brews/extraction';
import {
  checkBrewForm,
  formFromBrewRow,
  formFromDraft,
  fromLocalInput,
  tastedAtText,
  tasteValues,
  toLocalInput,
} from '@/lib/brews/form';
import { recentCustomTags } from '@/lib/brews/queries';
import { emptyBrewLogForm, type BrewLogForm } from '@/lib/brews/schema';

const NOW = Date.parse('2026-11-21T10:00:00Z');
const filled = (over: Partial<BrewLogForm> = {}): BrewLogForm => ({
  ...emptyBrewLogForm('2026-11-21T09:00:00Z'),
  overall: 7.5,
  ...over,
});

describe('checkBrewForm', () => {
  it('needs only the overall score', () => {
    expect(checkBrewForm(filled(), {}, NOW).ok).toBe(true);
    const missing = checkBrewForm(filled({ overall: null }), {}, NOW);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.issues.map((i) => i.field)).toEqual(['overall']);
  });

  it('says what is wrong with text typed into a number field', () => {
    const result = checkBrewForm(filled(), { tdsPct: 'abc', tastedAfterMin: '10 min' }, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        { field: 'tdsPct', message: 'Use a number, e.g. 1.38' },
        { field: 'tastedAfterMin', message: 'Use whole minutes, e.g. 10' },
      ]);
    }
  });

  it('gives a fractional number of minutes the same wording', () => {
    const result = checkBrewForm(filled({ tastedAfterMin: 7.5 }), {}, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]).toEqual({ field: 'tastedAfterMin', message: 'Use whole minutes, e.g. 10' });
  });

  it('refuses a brew time in the future and an unfinished time', () => {
    const future = checkBrewForm(filled({ brewedAt: '2026-11-21T11:00:00Z' }), {}, NOW);
    expect(future.ok).toBe(false);
    const unfinished = checkBrewForm(filled({ brewedAt: '' }), {}, NOW);
    expect(unfinished.ok).toBe(false);
  });

  it('lists issues in form order', () => {
    const result = checkBrewForm(filled({ overall: null, tdsPct: 25, notes: 'x'.repeat(5001) }), {}, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.field)).toEqual(['tdsPct', 'overall', 'notes']);
  });
});

describe('form from a draft and from a saved brew', () => {
  it('starts empty with the default time, and takes the timer’s drawdown', () => {
    const form = formFromDraft(null, { brewedAt: '2026-11-21T09:00:00Z', drawdownS: 175 });
    expect(form.brewedAt).toBe('2026-11-21T09:00:00Z');
    expect(form.drawdownS).toBe(175);
    expect(form.overall).toBeNull();
    expect(tasteValues(form)).toEqual(Array(8).fill(null));
  });

  it('a saved draft wins over the defaults, and a missing field keeps its default', () => {
    const form = formFromDraft(
      { drawdownS: 200, sweetness: 7, flavours: ['peach'] },
      { brewedAt: '2026-11-21T09:00:00Z', drawdownS: 175 },
    );
    expect(form.drawdownS).toBe(200);
    expect(form.sweetness).toBe(7);
    expect(form.flavours).toEqual(['peach']);
    expect(form.notes).toBe('');
  });

  it('reads a saved brew row', () => {
    const form = formFromBrewRow({
      brewed_at: '2026-11-20T08:00:00Z',
      drawdown_s: 170,
      beverage_g: 210,
      tds_pct: 1.4,
      sweetness: 7,
      acidity: null,
      brightness: null,
      body: 6.5,
      clarity: null,
      balance: null,
      aftertaste: null,
      overall: 8,
      flavours: ['orange'],
      tasted_temp: 'warm',
      tasted_after_min: 10,
      notes: null,
      next_change: 'Grind finer',
    });
    expect(form.overall).toBe(8);
    expect(form.notes).toBe('');
    expect(form.nextChange).toBe('Grind finer');
    expect(tasteValues(form)).toEqual([7, null, null, 6.5, null, null, null, 8]);
  });
});

describe('date-time text', () => {
  it('round-trips through the device’s time zone', () => {
    const iso = '2026-11-20T08:30:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
  });

  it('is empty for text that is not a whole date and time', () => {
    expect(fromLocalInput('')).toBe('');
    expect(fromLocalInput('2026-11-20')).toBe('');
    expect(toLocalInput('nonsense')).toBe('');
  });
});

describe('tasted at text', () => {
  it('reads naturally with either or both', () => {
    expect(tastedAtText('warm', 10)).toBe('Tasted warm, 10 min after brewing');
    expect(tastedAtText('hot', null)).toBe('Tasted hot');
    expect(tastedAtText(null, 20)).toBe('Tasted 20 min after brewing');
    expect(tastedAtText(null, null)).toBeNull();
  });
});

describe('extractionModel', () => {
  const targets = { ...NO_TARGETS, eyMin: 19, eyMax: 21, tdsMin: 1.3, tdsMax: 1.5, drawdownMinS: 165, drawdownMaxS: 195 };

  it('works out EY from TDS, beverage and dose, and reads each against its target', () => {
    const m = extractionModel({
      doseG: 15,
      brewWaterG: 250,
      bypassG: 0,
      tdsPct: 1.4,
      beverageG: 210,
      drawdownS: 200,
      targets,
    });
    expect(m.ey).toBe(19.6);
    expect(m.eyStatus).toBe('in');
    expect(m.tdsStatus).toBe('in');
    expect(m.drawdownStatus).toBe('above');
    expect(m.hasBypass).toBe(false);
  });

  it('has no EY until TDS and beverage are filled in, and prefers the stored figure', () => {
    expect(extractionModel({ doseG: 15, brewWaterG: 250, bypassG: 0, tdsPct: 1.4, beverageG: null, drawdownS: null, targets }).ey).toBeNull();
    const stored = extractionModel({ doseG: 15, brewWaterG: 250, bypassG: 40, tdsPct: 1.4, beverageG: 210, drawdownS: null, targets, storedEy: 18.2 });
    expect(stored.ey).toBe(18.2);
    expect(stored.eyStatus).toBe('below');
    expect(stored.hasBypass).toBe(true);
    expect(stored.overall).toBeCloseTo(19.33, 1);
  });

  it('says nothing about a target the version does not have', () => {
    const m = extractionModel({ doseG: 15, brewWaterG: 250, bypassG: 0, tdsPct: 1.4, beverageG: 210, drawdownS: 170, targets: NO_TARGETS });
    expect(m.eyStatus).toBeNull();
    expect(m.tdsStatus).toBeNull();
    expect(m.drawdownStatus).toBeNull();
  });
});

describe('recent custom tags', () => {
  it('skips presets, repeats and blanks, newest first, up to eight', () => {
    const rows = [
      { flavours: ['Peach', 'toasted almond', 'jasmine'] },
      { flavours: ['TOASTED ALMOND', 'lychee', ' '] },
      { flavours: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] },
    ];
    expect(recentCustomTags(rows)).toEqual(['toasted almond', 'jasmine', 'lychee', 'a', 'b', 'c', 'd', 'e']);
  });
});
