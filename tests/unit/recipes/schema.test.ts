import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  gearItemFormSchema,
  legacyFavouriteSchema,
  linkedFavouriteSchema,
  recipeFormSchema,
  stepSchema,
  stepsSchema,
  toRecipeRpcArgs,
  versionSchema,
  type RecipeFormInput,
} from '@/lib/recipes/schema';

const UUID = '11111111-1111-4111-8111-111111111111';

const base = (
  over: Partial<RecipeFormInput> = {},
  version: Record<string, unknown> = {},
): RecipeFormInput =>
  ({
    name: 'Morning V60',
    method: 'pour_over',
    method_custom: '',
    version: { dose_g: 15, brew_water_g: 250, ...version },
    ...over,
  }) as RecipeFormInput;

/** Issues as "path: message" strings. */
function issues(
  input: unknown,
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      error?: { issues: { path: PropertyKey[]; message: string }[] };
    };
  } = recipeFormSchema,
) {
  const r = schema.safeParse(input);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

describe('recipe form', () => {
  it('accepts the minimum: name, method, dose and brew water', () => {
    const r = recipeFormSchema.safeParse(base());
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.method_custom).toBeNull();
    expect(r.data.version).toMatchObject({
      dose_g: 15,
      brew_water_g: 250,
      bypass_g: 0,
      bypass_timing: 'none',
      steps_schema: 1,
      steps: [],
      gear: {},
      coffee_name: null,
      roast_date: null,
      temp_c: null,
      notes: null,
    });
  });

  it('reports each missing required field with a path the form can link to', () => {
    const found = issues({
      name: '',
      method: undefined,
      version: { dose_g: null, brew_water_g: null },
    });
    expect(found).toContain('name: Enter a name for the recipe');
    expect(found).toContain('method: Choose a method');
    expect(found).toContain('version.dose_g: Enter the coffee dose');
    expect(found).toContain('version.brew_water_g: Enter the brew water');
  });

  it('trims the name and enforces 1 to 80 characters', () => {
    expect(recipeFormSchema.parse(base({ name: '  Morning V60  ' })).name).toBe('Morning V60');
    expect(issues(base({ name: '   ' }))).toContain('name: Enter a name for the recipe');
    expect(issues(base({ name: 'x'.repeat(81) }))).toHaveLength(1);
    expect(issues(base({ name: 'x'.repeat(80) }))).toEqual([]);
  });

  it('requires a method name for Other (max 40) and drops it for other methods', () => {
    expect(issues(base({ method: 'other' }))).toEqual(['method_custom: Name the method']);
    expect(issues(base({ method: 'other', method_custom: '   ' }))).toEqual([
      'method_custom: Name the method',
    ]);
    expect(issues(base({ method: 'other', method_custom: 'x'.repeat(41) }))).toHaveLength(1);
    expect(
      recipeFormSchema.parse(base({ method: 'other', method_custom: ' Tsubame ' })).method_custom,
    ).toBe('Tsubame');
    expect(
      recipeFormSchema.parse(base({ method: 'aeropress', method_custom: 'left over' }))
        .method_custom,
    ).toBeNull();
  });

  it('rejects a method that does not exist', () => {
    expect(issues(base({ method: 'espresso' as never }))).toEqual(['method: Choose a method']);
  });

  it('builds the arguments of save_recipe', () => {
    const args = toRecipeRpcArgs(
      recipeFormSchema.parse(base({ method: 'other', method_custom: 'Tsubame' })),
    );
    expect(args).toMatchObject({
      p_name: 'Morning V60',
      p_method: 'other',
      p_method_custom: 'Tsubame',
    });
    expect(args.p_version.dose_g).toBe(15);
  });

  it('parsing twice gives the same result (so unchanged forms compare equal)', () => {
    const once = recipeFormSchema.parse(
      base(
        {},
        {
          coffee_name: '  Ethiopia ',
          temp_c: 93.04,
          steps: [
            { id: 'a', kind: 'pour', at_s: 0, target_g: 30.04, technique: '', rate_gps: null },
          ],
        },
      ),
    );
    expect(recipeFormSchema.parse(once)).toEqual(once);
  });
});

describe('version limits mirror the database', () => {
  const parse = (v: Record<string, unknown>) =>
    versionSchema.safeParse({ dose_g: 15, brew_water_g: 250, ...v });
  const fails = (v: Record<string, unknown>) => !parse(v).success;

  it('dose is above 0 and at most 200 g; brew water above 0 and at most 3000 g', () => {
    expect(fails({ dose_g: 0 })).toBe(true);
    expect(fails({ dose_g: 200.1 })).toBe(true);
    expect(fails({ dose_g: 200 })).toBe(false);
    expect(fails({ dose_g: -3 })).toBe(true);
    expect(fails({ brew_water_g: 0 })).toBe(true);
    expect(fails({ brew_water_g: 3000.1 })).toBe(true);
    expect(fails({ brew_water_g: 3000 })).toBe(false);
  });

  it('weights are kept to 0.1 g, and a rounded-to-zero dose is rejected', () => {
    const v = versionSchema.parse({ dose_g: 15.04, brew_water_g: 249.96, bypass_g: 0.04 });
    expect(v.dose_g).toBe(15);
    expect(v.brew_water_g).toBe(250);
    expect(v.bypass_g).toBe(0);
    expect(fails({ dose_g: 0.04 })).toBe(true);
    // 1 oz is 28.35 g: kept as 28.4 (rounded half up), not a 28.349… that the column can't hold
    expect(versionSchema.parse({ dose_g: 28.349523125, brew_water_g: 250 }).dose_g).toBe(28.3);
  });

  it('bypass is 0 to 3000 g and needs a timing; a timing needs bypass', () => {
    expect(fails({ bypass_g: 3000.1, bypass_timing: 'after' })).toBe(true);
    expect(issues({ dose_g: 15, brew_water_g: 250, bypass_g: 50 }, versionSchema)).toEqual([
      'bypass_timing: Choose when the bypass water goes in',
    ]);
    expect(
      issues({ dose_g: 15, brew_water_g: 250, bypass_g: 0, bypass_timing: 'after' }, versionSchema),
    ).toEqual(['bypass_g: Enter the bypass water, or choose None']);
    expect(fails({ bypass_g: 300, bypass_timing: 'after' })).toBe(false);
    expect(fails({ bypass_g: null, bypass_timing: null })).toBe(false);
  });

  it('temperature 0 to 100 °C, retention 0 to 5, grind size 50 to 2000 µm, water 0 to 1000 ppm, altitude 0 to 4000 m', () => {
    expect(fails({ temp_c: 100.1 })).toBe(true);
    expect(fails({ temp_c: -1 })).toBe(true);
    expect(fails({ temp_c: 100 })).toBe(false);
    expect(fails({ retention_ratio: 5.1 })).toBe(true);
    expect(fails({ retention_ratio: 0 })).toBe(false);
    expect(fails({ grind_microns: 49 })).toBe(true);
    expect(fails({ grind_microns: 2001 })).toBe(true);
    expect(fails({ grind_microns: 600.5 })).toBe(true);
    expect(fails({ water_ppm: 1001 })).toBe(true);
    expect(fails({ water_ppm: 0 })).toBe(false);
    expect(fails({ altitude_m: 4001 })).toBe(true);
    expect(fails({ altitude_m: 1800 })).toBe(false);
  });

  it('text limits: coffee 80, process 60, scale 30, grind setting 40, notes 5000, change note 200', () => {
    expect(fails({ coffee_name: 'x'.repeat(81) })).toBe(true);
    expect(fails({ coffee_name: 'x'.repeat(80) })).toBe(false);
    expect(fails({ roaster: 'x'.repeat(81) })).toBe(true);
    expect(fails({ origin: 'x'.repeat(81) })).toBe(true);
    expect(fails({ varietal: 'x'.repeat(81) })).toBe(true);
    expect(fails({ process: 'x'.repeat(61) })).toBe(true);
    expect(fails({ colour_scale: 'x'.repeat(31) })).toBe(true);
    expect(fails({ grind_setting: 'x'.repeat(41) })).toBe(true);
    expect(fails({ notes: 'x'.repeat(LIMITS.notes) })).toBe(false);
    expect(fails({ notes: 'x'.repeat(LIMITS.notes + 1) })).toBe(true);
    expect(fails({ change_note: 'x'.repeat(201) })).toBe(true);
  });

  it('turns empty text into null and trims the rest', () => {
    const v = versionSchema.parse({
      dose_g: 15,
      brew_water_g: 250,
      coffee_name: '   ',
      roaster: ' Onyx ',
      notes: '',
    });
    expect(v.coffee_name).toBeNull();
    expect(v.roaster).toBe('Onyx');
    expect(v.notes).toBeNull();
  });

  it('roast date is a calendar date kept as typed, never shifted by a time zone', () => {
    expect(
      versionSchema.parse({ dose_g: 15, brew_water_g: 250, roast_date: '2026-11-14' }).roast_date,
    ).toBe('2026-11-14');
    expect(fails({ roast_date: '2026-02-30' })).toBe(true);
    expect(fails({ roast_date: '14/11/2026' })).toBe(true);
    expect(fails({ roast_date: '2026-11-14T00:00:00Z' })).toBe(true);
    expect(parse({ roast_date: null }).success).toBe(true);
  });

  it('roast level must be one of the five', () => {
    expect(fails({ roast_level: 'burnt' })).toBe(true);
    expect(fails({ roast_level: 'medium_light' })).toBe(false);
  });

  it('target ranges need min ≤ max for drawdown, TDS and EY', () => {
    expect(
      issues(
        { dose_g: 15, brew_water_g: 250, drawdown_min_s: 200, drawdown_max_s: 100 },
        versionSchema,
      ),
    ).toHaveLength(1);
    expect(
      issues({ dose_g: 15, brew_water_g: 250, tds_min: 1.5, tds_max: 1.2 }, versionSchema),
    ).toHaveLength(1);
    expect(
      issues({ dose_g: 15, brew_water_g: 250, ey_min: 22, ey_max: 18 }, versionSchema),
    ).toHaveLength(1);
    expect(fails({ drawdown_min_s: 150, drawdown_max_s: 150 })).toBe(false);
    expect(fails({ drawdown_min_s: 150 })).toBe(false);
    expect(fails({ tds_max: 1.4 })).toBe(false);
    expect(fails({ tds_max: 20.1 })).toBe(true);
    expect(fails({ ey_max: 40.1 })).toBe(true);
  });

  it('steps_schema is always 1', () => {
    expect(versionSchema.parse({ dose_g: 15, brew_water_g: 250 }).steps_schema).toBe(1);
    expect(fails({ steps_schema: 2 })).toBe(true);
  });

  it('gear entries keep ids and names and drop anything else (no nickname)', () => {
    const v = versionSchema.parse({
      dose_g: 15,
      brew_water_g: 250,
      gear: {
        brewer: { item_id: UUID, catalog_id: UUID, name: 'Hario V60 02', nickname: 'Kitchen V60' },
        scale: { name: 'Acaia' },
      },
    });
    expect(v.gear).toEqual({
      brewer: { item_id: UUID, catalog_id: UUID, name: 'Hario V60 02' },
      scale: { name: 'Acaia' },
    });
    expect(fails({ gear: { brewer: { name: '' } } })).toBe(true);
    expect(fails({ gear: { brewer: { item_id: 'nope', name: 'x' } } })).toBe(true);
    expect(fails({ brewer_catalog_id: 'nope' })).toBe(true);
    expect(parse({ brewer_catalog_id: UUID }).success).toBe(true);
  });
});

describe('steps', () => {
  const parse = (steps: unknown[]) => stepsSchema.safeParse(steps);

  it('parses each kind and leaves out empty optional fields', () => {
    const steps = stepsSchema.parse([
      { id: 'a', kind: 'pour', at_s: 0, target_g: 30, rate_gps: null, temp_c: null, technique: '' },
      { id: 'b', kind: 'swirl', at_s: 10, duration_s: 5, technique: '  gentle ' },
      { id: 'c', kind: 'wait', at_s: 15, duration_s: null },
      { id: 'd', kind: 'other', at_s: 20, label: ' Open valve ' },
    ]);
    expect(steps).toEqual([
      { id: 'a', kind: 'pour', at_s: 0, target_g: 30 },
      { id: 'b', kind: 'swirl', at_s: 10, duration_s: 5, technique: 'gentle' },
      { id: 'c', kind: 'wait', at_s: 15 },
      { id: 'd', kind: 'other', at_s: 20, label: 'Open valve' },
    ]);
  });

  it('keeps per-pour temperature and rate', () => {
    const [p] = stepsSchema.parse([
      { id: 'a', kind: 'pour', at_s: 0, target_g: 30, rate_gps: 3.456, temp_c: 92.04 },
    ]);
    expect(p).toMatchObject({ rate_gps: 3.46, temp_c: 92 });
  });

  it('a pour needs a weight above 0 and at most 3000 g', () => {
    expect(parse([{ id: 'a', kind: 'pour', at_s: 0 }]).success).toBe(false);
    expect(parse([{ id: 'a', kind: 'pour', at_s: 0, target_g: null }]).success).toBe(false);
    expect(parse([{ id: 'a', kind: 'pour', at_s: 0, target_g: 0 }]).success).toBe(false);
    expect(parse([{ id: 'a', kind: 'pour', at_s: 0, target_g: 3000.1 }]).success).toBe(false);
    expect(parse([{ id: 'a', kind: 'pour', at_s: 0, target_g: 3000 }]).success).toBe(true);
  });

  it('times and durations are whole seconds from 0 to 48 hours', () => {
    expect(parse([{ id: 'a', kind: 'wait', at_s: 172_800, duration_s: 172_800 }]).success).toBe(
      true,
    );
    expect(parse([{ id: 'a', kind: 'wait', at_s: 172_801 }]).success).toBe(false);
    expect(parse([{ id: 'a', kind: 'wait', at_s: -1 }]).success).toBe(false);
    expect(parse([{ id: 'a', kind: 'wait', at_s: 1.5 }]).success).toBe(false);
    expect(parse([{ id: 'a', kind: 'wait', at_s: 0, duration_s: 172_801 }]).success).toBe(false);
    expect(parse([{ id: 'a', kind: 'wait' }]).success).toBe(false);
  });

  it('an other step needs a label of at most 60 characters; technique at most 120', () => {
    expect(parse([{ id: 'a', kind: 'other', at_s: 0 }]).success).toBe(false);
    expect(parse([{ id: 'a', kind: 'other', at_s: 0, label: '  ' }]).success).toBe(false);
    expect(parse([{ id: 'a', kind: 'other', at_s: 0, label: 'x'.repeat(61) }]).success).toBe(false);
    expect(parse([{ id: 'a', kind: 'other', at_s: 0, label: 'x'.repeat(60) }]).success).toBe(true);
    expect(parse([{ id: 'a', kind: 'wait', at_s: 0, technique: 'x'.repeat(121) }]).success).toBe(
      false,
    );
    expect(parse([{ id: 'a', kind: 'wait', at_s: 0, technique: 'x'.repeat(120) }]).success).toBe(
      true,
    );
  });

  it('rejects an unknown kind and a missing id', () => {
    expect(parse([{ id: 'a', kind: 'bloom', at_s: 0 }]).success).toBe(false);
    expect(parse([{ kind: 'wait', at_s: 0 }]).success).toBe(false);
    expect(parse([{ id: '', kind: 'wait', at_s: 0 }]).success).toBe(false);
  });

  it('allows 30 steps and rejects 31', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `s${i}`, kind: 'wait', at_s: i }));
    expect(parse(many(30)).success).toBe(true);
    expect(parse(many(31)).success).toBe(false);
  });

  it('flags a step that starts before the one above, with the field path', () => {
    const r = parse([
      { id: 'a', kind: 'pour', at_s: 0, target_g: 30 },
      { id: 'b', kind: 'wait', at_s: 40 },
      { id: 'c', kind: 'wait', at_s: 30 },
    ]);
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([
      '2.at_s: Step 3 starts before step 2',
    ]);
  });

  it('flags a pour that is not higher than the pour before', () => {
    const r = parse([
      { id: 'a', kind: 'pour', at_s: 0, target_g: 100 },
      { id: 'b', kind: 'pour', at_s: 30, target_g: 100 },
    ]);
    expect(r.error?.issues.map((i) => i.path.join('.'))).toEqual(['1.target_g']);
  });

  it('allows a last pour that is not the brew water (a warning, not an error)', () => {
    const result = versionSchema.safeParse({
      dose_g: 15,
      brew_water_g: 250,
      steps: [{ id: 'a', kind: 'pour', at_s: 0, target_g: 240 }],
    });
    expect(result.success).toBe(true);
  });

  it('the single step schema is exported for the editor', () => {
    expect(stepSchema.safeParse({ id: 'a', kind: 'press', at_s: 60, duration_s: 30 }).success).toBe(
      true,
    );
  });
});

describe('gear item form', () => {
  const ok = (v: Record<string, unknown>) =>
    gearItemFormSchema.safeParse({ category: 'grinder', ...v });

  it('needs a catalogue item or a custom name', () => {
    expect(ok({}).success).toBe(false);
    expect(ok({ custom_name: '   ' }).success).toBe(false);
    expect(ok({ catalog_id: UUID }).success).toBe(true);
    expect(ok({ custom_name: 'Hand grinder' }).success).toBe(true);
  });

  it('a catalogue item wins over a custom name', () => {
    expect(
      gearItemFormSchema.parse({ category: 'brewer', catalog_id: UUID, custom_name: 'x' })
        .custom_name,
    ).toBeNull();
  });

  it('limits: custom name 80, nickname 40, notes 500', () => {
    expect(ok({ custom_name: 'x'.repeat(81) }).success).toBe(false);
    expect(ok({ custom_name: 'x'.repeat(80) }).success).toBe(true);
    expect(ok({ custom_name: 'x', nickname: 'x'.repeat(41) }).success).toBe(false);
    expect(ok({ custom_name: 'x', notes: 'x'.repeat(501) }).success).toBe(false);
    expect(ok({ custom_name: 'x', notes: 'x'.repeat(500) }).success).toBe(true);
  });

  it('defaults to not being the default, and needs a real category', () => {
    expect(gearItemFormSchema.parse({ category: 'kettle', custom_name: 'k' }).is_default).toBe(
      false,
    );
    expect(gearItemFormSchema.safeParse({ category: 'toaster', custom_name: 'k' }).success).toBe(
      false,
    );
  });
});

describe('favourite gear entries', () => {
  it('a linked entry has an item id; a legacy one does not', () => {
    expect(
      linkedFavouriteSchema.safeParse({ item_id: UUID, category: 'grinder', name: 'C40' }).success,
    ).toBe(true);
    expect(linkedFavouriteSchema.safeParse({ category: 'grinder', name: 'C40' }).success).toBe(
      false,
    );
    expect(legacyFavouriteSchema.safeParse({ category: 'grinder', name: 'C40' }).success).toBe(
      true,
    );
  });
});
