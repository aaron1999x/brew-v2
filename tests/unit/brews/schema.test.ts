import { describe, expect, it } from 'vitest';
import {
  BREW_LIMITS,
  PRESET_FLAVOURS,
  TASTE_KEYS,
  addFlavour,
  emptyBrewLogForm,
  normalizeFlavours,
  quickChangeSchema,
  toLogBrewPayload,
  validateBrewLog,
  type BrewLogForm,
} from '@/lib/brews/schema';
import { ERROR_MESSAGES } from '@/lib/errors/messages';
import { IMPERIAL, METRIC, V60 } from './fixtures';

const NOW = Date.parse('2026-11-20T10:00:00.000Z');
const BREWED = '2026-11-20T09:50:00.000Z';

const form = (patch: Partial<BrewLogForm> = {}): BrewLogForm => ({
  ...emptyBrewLogForm(BREWED),
  overall: 7.5,
  ...patch,
});

const issuesFor = (patch: Partial<BrewLogForm>) => {
  const r = validateBrewLog(form(patch), NOW);
  return r.ok ? [] : r.issues.map((i) => i.field);
};

describe('the log form', () => {
  it('needs only the overall score', () => {
    const r = validateBrewLog(form(), NOW);
    expect(r.ok).toBe(true);
  });

  it('asks for overall and says so in plain words', () => {
    const r = validateBrewLog(emptyBrewLogForm(BREWED), NOW);
    expect(r).toEqual({
      ok: false,
      issues: [{ field: 'overall', message: ERROR_MESSAGES.overall_required }],
    });
  });

  it('starts with nothing scored', () => {
    const empty = emptyBrewLogForm(BREWED);
    for (const key of TASTE_KEYS) expect(empty[key]).toBeNull();
    expect(empty.flavours).toEqual([]);
  });

  it('has the eight taste scores in the prototype order', () => {
    expect(TASTE_KEYS).toEqual([
      'sweetness',
      'acidity',
      'brightness',
      'body',
      'clarity',
      'balance',
      'aftertaste',
      'overall',
    ]);
  });

  it('takes scores from 0 to 10 in half steps', () => {
    for (const ok of [0, 0.5, 5, 9.5, 10]) expect(issuesFor({ sweetness: ok })).toEqual([]);
    for (const bad of [-0.5, 10.5, 7.3, 0.25]) expect(issuesFor({ sweetness: bad })).toEqual(['sweetness']);
    expect(issuesFor({ overall: 11 })).toEqual(['overall']);
    expect(issuesFor({ overall: 7.3 })).toEqual(['overall']);
  });

  it('limits TDS, drawdown, beverage and tasted-after like the database', () => {
    expect(issuesFor({ tdsPct: 20 })).toEqual([]);
    expect(issuesFor({ tdsPct: 20.1 })).toEqual(['tdsPct']);
    expect(issuesFor({ tdsPct: -1 })).toEqual(['tdsPct']);
    expect(issuesFor({ drawdownS: BREW_LIMITS.drawdownMaxS })).toEqual([]);
    expect(issuesFor({ drawdownS: 7201 })).toEqual(['drawdownS']);
    expect(issuesFor({ drawdownS: 12.5 })).toEqual(['drawdownS']);
    expect(issuesFor({ beverageG: 3000 })).toEqual([]);
    expect(issuesFor({ beverageG: 3000.1 })).toEqual(['beverageG']);
    expect(issuesFor({ tastedAfterMin: 240 })).toEqual([]);
    expect(issuesFor({ tastedAfterMin: 241 })).toEqual(['tastedAfterMin']);
    expect(issuesFor({ tastedAfterMin: -1 })).toEqual(['tastedAfterMin']);
  });

  it('limits notes and next time, and the tasted-at choice', () => {
    expect(issuesFor({ notes: 'x'.repeat(5000), nextChange: 'y'.repeat(1000) })).toEqual([]);
    expect(issuesFor({ notes: 'x'.repeat(5001) })).toEqual(['notes']);
    expect(issuesFor({ nextChange: 'y'.repeat(1001) })).toEqual(['nextChange']);
    expect(issuesFor({ tastedTemp: 'lukewarm' as never })).toEqual(['tastedTemp']);
    for (const t of ['hot', 'warm', 'cool'] as const) expect(issuesFor({ tastedTemp: t })).toEqual([]);
  });

  it('limits flavours: 12 tags of up to 30 characters, each once', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `tag${i}`);
    expect(issuesFor({ flavours: twelve })).toEqual([]);
    expect(issuesFor({ flavours: [...twelve, 'one more'] })).toEqual(['flavours']);
    expect(issuesFor({ flavours: ['x'.repeat(30)] })).toEqual([]);
    expect(issuesFor({ flavours: ['x'.repeat(31)] })).toEqual(['flavours']);
    expect(issuesFor({ flavours: ['Peach', 'peach'] })).toEqual(['flavours']);
    expect(issuesFor({ flavours: ['   '] })).toEqual(['flavours']);
  });

  it('does not let the brew be dated in the future, within a minute of clock drift', () => {
    expect(issuesFor({ brewedAt: new Date(NOW + 30_000).toISOString() })).toEqual([]);
    expect(issuesFor({ brewedAt: new Date(NOW + 120_000).toISOString() })).toEqual(['brewedAt']);
    expect(issuesFor({ brewedAt: 'yesterday-ish' })).toEqual(['brewedAt']);
  });

  it('lists problems in form order for the error summary', () => {
    const r = validateBrewLog(
      form({ overall: null, tdsPct: 25, notes: 'x'.repeat(6000), brewedAt: 'nope' }),
      NOW,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.field)).toEqual(['brewedAt', 'tdsPct', 'overall', 'notes']);
  });
});

describe('flavours', () => {
  it('has the prototype presets', () => {
    expect(PRESET_FLAVOURS).toEqual([
      'orange',
      'mandarin',
      'red apple',
      'peach',
      'apricot',
      'brown sugar',
      'caramel',
      'milk chocolate',
      'cocoa',
      'black tea',
      'floral',
    ]);
  });

  it('adds a trimmed tag', () => {
    expect(addFlavour(['peach'], '  dark cherry ')).toEqual({ ok: true, tags: ['peach', 'dark cherry'] });
  });

  it('refuses empty, long, repeated (ignoring case) and a 13th tag', () => {
    expect(addFlavour([], '   ')).toMatchObject({ ok: false, reason: 'empty' });
    expect(addFlavour([], 'x'.repeat(31))).toMatchObject({ ok: false, reason: 'too_long' });
    expect(addFlavour(['Peach'], ' peach ')).toMatchObject({ ok: false, reason: 'duplicate' });
    const twelve = Array.from({ length: 12 }, (_, i) => `tag${i}`);
    expect(addFlavour(twelve, 'extra')).toMatchObject({ ok: false, reason: 'too_many', tags: twelve });
  });

  it('cleans a list: trims, drops empties and repeats, keeps the first spelling', () => {
    expect(normalizeFlavours([' Peach', '', 'peach', 'Floral ', 'FLORAL'])).toEqual(['Peach', 'Floral']);
  });
});

describe('the quick change schema', () => {
  it('accepts a partial change and an empty one', () => {
    expect(quickChangeSchema.safeParse({}).success).toBe(true);
    expect(quickChangeSchema.safeParse({ grindSetting: '17' }).success).toBe(true);
    expect(quickChangeSchema.safeParse({ grindSetting: null, tempC: null }).success).toBe(true);
    expect(quickChangeSchema.safeParse({ doseG: 16, brewWaterG: 270, tempC: 94 }).success).toBe(true);
  });

  it('keeps the version limits', () => {
    expect(quickChangeSchema.safeParse({ grindSetting: 'x'.repeat(40) }).success).toBe(true);
    expect(quickChangeSchema.safeParse({ grindSetting: 'x'.repeat(41) }).success).toBe(false);
    expect(quickChangeSchema.safeParse({ tempC: 101 }).success).toBe(false);
    expect(quickChangeSchema.safeParse({ tempC: -1 }).success).toBe(false);
    expect(quickChangeSchema.safeParse({ doseG: 0 }).success).toBe(false);
    expect(quickChangeSchema.safeParse({ doseG: 200.1 }).success).toBe(false);
    expect(quickChangeSchema.safeParse({ brewWaterG: 3001 }).success).toBe(false);
  });
});

describe('toLogBrewPayload', () => {
  const base = (patch: Partial<Parameters<typeof toLogBrewPayload>[0]> = {}) =>
    toLogBrewPayload({
      sessionId: '33333333-3333-4333-8333-333333333333',
      versionId: 'v-1',
      base: V60,
      quickChange: null,
      form: form(),
      timerUsed: true,
      units: METRIC,
      now: new Date('2026-11-20T10:05:00.000Z'),
      ...patch,
    });

  it('maps the form to the brew columns', () => {
    const { brew, newVersion } = base({
      form: form({
        drawdownS: 167,
        beverageG: 215.04,
        tdsPct: 1.385,
        sweetness: 7,
        clarity: 6.5,
        flavours: [' Peach', 'peach', 'floral'],
        tastedTemp: 'warm',
        tastedAfterMin: 10,
        notes: 'Sweet and clean',
        nextChange: '',
      }),
    });
    expect(newVersion).toBeNull();
    expect(brew).toEqual({
      id: '33333333-3333-4333-8333-333333333333',
      recipe_version_id: 'v-1',
      brewed_at: BREWED,
      source: 'timer',
      drawdown_s: 167,
      beverage_g: 215,
      tds_pct: 1.39,
      sweetness: 7,
      acidity: null,
      brightness: null,
      body: null,
      clarity: 6.5,
      balance: null,
      aftertaste: null,
      overall: 7.5,
      flavours: ['Peach', 'floral'],
      tasted_temp: 'warm',
      tasted_after_min: 10,
      notes: 'Sweet and clean',
      next_change: null,
      client_updated_at: '2026-11-20T10:05:00.000Z',
    });
  });

  it('marks a log-only brew as manual', () => {
    expect(base({ timerUsed: false }).brew.source).toBe('manual');
  });

  it('saves with only the overall score', () => {
    const { brew } = base();
    expect(brew.overall).toBe(7.5);
    expect(brew.flavours).toEqual([]);
    expect(brew.notes).toBeNull();
  });

  it('refuses to build a payload without overall', () => {
    expect(() => base({ form: form({ overall: null }) })).toThrow('overall_required');
  });

  it('turns a quick change into the new version with scaled steps and a change note', () => {
    const { newVersion } = base({ quickChange: { grindSetting: '17', tempC: 94, brewWaterG: 275 } });
    expect(newVersion).toMatchObject({
      grind_setting: '17',
      temp_c: 94,
      dose_g: 15,
      brew_water_g: 275,
      change_note: 'Brewed with changes: grind 18 → 17, 93 → 94 °C, water 250 → 275 g',
    });
    expect(newVersion!.steps.filter((s) => s.kind === 'pour').map((s) => [s.target_g, s.temp_c])).toEqual([
      [33, 94],
      [110, 94],
      [187, 94],
      [275, 94],
    ]);
  });

  it('writes the change note in the units the person uses', () => {
    const { newVersion } = base({ quickChange: { tempC: 94 }, units: IMPERIAL });
    expect(newVersion!.change_note).toBe('Brewed with changes: 199.4 → 201.2 °F');
    expect(newVersion!.temp_c).toBe(94); // stored metric
  });

  it('sends no new version for a change that matches the version again', () => {
    expect(base({ quickChange: { grindSetting: '18', tempC: 93 } }).newVersion).toBeNull();
    expect(base({ quickChange: {} }).newVersion).toBeNull();
  });

  it('sends exactly the keys log_brew accepts, and only pour targets and temperatures differ in the steps', () => {
    const { newVersion } = base({ quickChange: { doseG: 16, brewWaterG: 275, tempC: 94, grindSetting: '17' } });
    expect(Object.keys(newVersion!).sort()).toEqual(
      ['brew_water_g', 'change_note', 'dose_g', 'grind_setting', 'steps', 'temp_c'].sort(),
    );
    // The same rule log_brew applies in SQL: strip target_g and temp_c from pours, then compare.
    const strip = (steps: readonly object[]) =>
      steps.map((s) => {
        const { target_g, temp_c, ...rest } = s as Record<string, unknown>;
        void target_g;
        void temp_c;
        return (s as { kind: string }).kind === 'pour' ? rest : s;
      });
    expect(strip(newVersion!.steps)).toEqual(strip(V60.steps));
    expect(newVersion!.change_note.length).toBeLessThanOrEqual(200);
  });
});
