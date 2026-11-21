import { z } from 'zod';
import { DURATION_MAX_S, roundTo } from '@/lib/units';
import { GEAR_CATEGORIES, RECIPE_GEAR_CATEGORIES } from './gear';
import {
  BREW_METHODS,
  BYPASS_TIMINGS,
  METHOD_CUSTOM_MAX,
  ROAST_LEVELS,
  type BrewMethod,
} from './methods';
import { LABEL_MAX, MAX_STEPS, TECHNIQUE_MAX, validateSteps } from './steps';

/**
 * One Zod schema set for the recipe form and the RPC payload (`create_recipe` / `save_recipe`),
 * with limits that mirror the database. Parsing also normalises: text is trimmed and empty text
 * becomes null, numbers are rounded to the precision the columns hold (weights to 0.1 g), and empty
 * optional step fields are left out. Parsing twice gives the same result, so "did anything
 * change?" can compare parsed values.
 *
 * Messages are plain and unit-free: they can't know whether the person works in grams or ounces.
 */

export const LIMITS = {
  name: 80,
  coffeeText: 80,
  process: 60,
  colourScale: 30,
  grindSetting: 40,
  altitudeM: 4000,
  doseG: 200,
  waterG: 3000,
  tempC: 100,
  notes: 5000,
  changeNote: 200,
  gearName: 80,
  nickname: 40,
  gearNotes: 500,
} as const;

// ---- building blocks ------------------------------------------------------------------------

/** Optional text: trimmed, too long is an error, empty becomes null. */
const optText = (max: number, what: string) =>
  z
    .string()
    .trim()
    .max(max, `${what} can be up to ${max} characters`)
    .nullish()
    .transform((v): string | null => (v ? v : null));

type NumberRules = { min: number; max: number; dp: number; int?: boolean; gt?: boolean };

/** A number rounded to `dp` decimals first, then range-checked (so 0.04 g is not "above 0"). */
function ranged(what: string, rules: NumberRules, invalid: string = `Enter ${what}`) {
  const base = rules.int ? z.number({ error: invalid }).int(invalid) : z.number({ error: invalid });
  return base
    .transform((n) => roundTo(n, rules.dp))
    .pipe(z.number().min(rules.min, `${what} is too low`).max(rules.max, `${what} is too high`));
}

/**
 * What a field says when its text isn't a usable number (or, for a whole-number field, has a
 * decimal point). The editor shows the same text whether the text is unreadable ("abc") or a number
 * that isn't allowed ("7.5" microns), through the error summary.
 */
export const NUMBER_HELP = {
  altitude_m: 'Use whole metres, e.g. 1800',
  colour_reading: 'Use a number, e.g. 58.5',
  retention_ratio: 'Use a number, e.g. 2.0',
  grind_microns: 'Use whole microns, e.g. 750',
  water_ppm: 'Use whole ppm, e.g. 75',
  tds_min: 'Use a number, e.g. 1.38',
  tds_max: 'Use a number, e.g. 1.38',
  ey_min: 'Use a number, e.g. 20.5',
  ey_max: 'Use a number, e.g. 20.5',
} as const;
export type NumberHelpKey = keyof typeof NUMBER_HELP;

/** Optional number: null/undefined become null, anything else must be in range. */
const optNumber = (what: string, rules: NumberRules, invalid: string = `${what} must be a number`) =>
  ranged(what, rules, invalid)
    .nullish()
    .transform((v): number | null => v ?? null);

const gramsStep = 0.1;

/** A required weight in grams: more than 0, at most `max`, kept to 0.1 g. */
const requiredWeight = (required: string, what: string, max: number) =>
  ranged(what, { min: gramsStep, max, dp: 1 }, required);

// ---- steps ----------------------------------------------------------------------------------

const stepId = z.string().min(1).max(64);
const stepTime = z
  .number({ error: 'Enter a time' })
  .int('Use whole seconds')
  .min(0, 'The time is too low')
  .max(DURATION_MAX_S, 'The time is too long (48 hours at most)');
const optDuration = z
  .number({ error: 'Duration must be a number' })
  .int('Use whole seconds')
  .min(0, 'The duration is too low')
  .max(DURATION_MAX_S, 'The duration is too long (48 hours at most)')
  .nullish();
const technique = optText(TECHNIQUE_MAX, 'Technique');

/** Leaves out null, undefined and empty-string fields so saved steps stay small and comparable. */
function compact<T extends Record<string, unknown>>(step: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(step)) {
    if (value !== null && value !== undefined && value !== '') out[key] = value;
  }
  return out as T;
}

const pourStep = z.object({
  id: stepId,
  kind: z.literal('pour'),
  at_s: stepTime,
  target_g: ranged(
    'The pour weight',
    { min: gramsStep, max: LIMITS.waterG, dp: 1 },
    'Enter the weight for this pour',
  ),
  rate_gps: optNumber('The pour rate', { min: 0.01, max: 50, dp: 2 }),
  temp_c: optNumber('The pour temperature', { min: 0, max: LIMITS.tempC, dp: 1 }),
  technique,
});

const timedStep = z.object({
  id: stepId,
  kind: z.enum(['wait', 'swirl', 'stir', 'press']),
  at_s: stepTime,
  duration_s: optDuration,
  technique,
});

const otherStep = z.object({
  id: stepId,
  kind: z.literal('other'),
  at_s: stepTime,
  label: z
    .string({ error: 'Add a label for this step' })
    .trim()
    .min(1, 'Add a label for this step')
    .max(LABEL_MAX, `The label can be up to ${LABEL_MAX} characters`),
  duration_s: optDuration,
  technique,
});

export const stepSchema = z
  .discriminatedUnion('kind', [pourStep, timedStep, otherStep])
  .transform((s) => compact(s));
export type Step = z.output<typeof stepSchema>;
export type StepInput = z.input<typeof stepSchema>;

export const stepsSchema = z
  .array(stepSchema)
  .max(MAX_STEPS, `A recipe can have up to ${MAX_STEPS} steps`)
  .superRefine((steps, ctx) => {
    // Order and cumulative-pour rules; a missing label is already reported by the step itself.
    for (const issue of validateSteps(steps)) {
      if (issue.code === 'label_required') continue;
      ctx.addIssue({ code: 'custom', path: [issue.index, issue.field], message: issue.message });
    }
  });

// ---- gear snapshot --------------------------------------------------------------------------

export const gearEntrySchema = z.object({
  item_id: z.uuid().optional(),
  catalog_id: z.uuid().optional(),
  name: z.string().trim().min(1).max(LIMITS.gearName),
});

export const gearSnapshotSchema = z
  .object(
    Object.fromEntries(
      RECIPE_GEAR_CATEGORIES.map((c) => [c, gearEntrySchema.optional()]),
    ) as Record<(typeof RECIPE_GEAR_CATEGORIES)[number], z.ZodOptional<typeof gearEntrySchema>>,
  )
  .nullish()
  .transform((g) => g ?? {});

// ---- version --------------------------------------------------------------------------------

const rangeOrder = (
  ctx: z.RefinementCtx,
  min: number | null,
  max: number | null,
  path: string,
  message: string,
) => {
  if (min != null && max != null && min > max)
    ctx.addIssue({ code: 'custom', path: [path], message });
};

const versionObject = z.object({
  change_note: optText(LIMITS.changeNote, 'The change note'),
  // coffee
  coffee_name: optText(LIMITS.coffeeText, 'The coffee name'),
  roaster: optText(LIMITS.coffeeText, 'The roaster'),
  origin: optText(LIMITS.coffeeText, 'The origin'),
  process: optText(LIMITS.process, 'The process'),
  varietal: optText(LIMITS.coffeeText, 'The varietal'),
  altitude_m: optNumber('The altitude', { min: 0, max: LIMITS.altitudeM, dp: 0, int: true }, NUMBER_HELP.altitude_m),
  roast_level: z
    .enum(ROAST_LEVELS)
    .nullish()
    .transform((v) => v ?? null),
  /** A calendar date (YYYY-MM-DD). Never converted through UTC or a time zone. */
  roast_date: z.iso
    .date({ error: 'Enter a valid date' })
    .nullish()
    .transform((v): string | null => v ?? null),
  colour_reading: optNumber('The colour reading', { min: 0, max: 99999.9, dp: 1 }, NUMBER_HELP.colour_reading),
  colour_scale: optText(LIMITS.colourScale, 'The colour scale'),
  // gear
  gear: gearSnapshotSchema,
  brewer_catalog_id: z
    .uuid()
    .nullish()
    .transform((v): string | null => v ?? null),
  grinder_catalog_id: z
    .uuid()
    .nullish()
    .transform((v): string | null => v ?? null),
  // numbers
  dose_g: requiredWeight('Enter the coffee dose', 'The coffee dose', LIMITS.doseG),
  brew_water_g: requiredWeight('Enter the brew water', 'The brew water', LIMITS.waterG),
  bypass_g: ranged('The bypass water', { min: 0, max: LIMITS.waterG, dp: 1 })
    .nullish()
    .transform((v): number => v ?? 0),
  bypass_timing: z
    .enum(BYPASS_TIMINGS)
    .nullish()
    .transform((v) => v ?? 'none'),
  retention_ratio: optNumber('The retention', { min: 0, max: 5, dp: 1 }, NUMBER_HELP.retention_ratio),
  temp_c: optNumber('The temperature', { min: 0, max: LIMITS.tempC, dp: 1 }),
  grind_setting: optText(LIMITS.grindSetting, 'The grind setting'),
  grind_microns: optNumber('The particle size', { min: 50, max: 2000, dp: 0, int: true }, NUMBER_HELP.grind_microns),
  water_ppm: optNumber('The water hardness', { min: 0, max: 1000, dp: 0, int: true }, NUMBER_HELP.water_ppm),
  // targets
  drawdown_min_s: optNumber('The drawdown time', { min: 0, max: DURATION_MAX_S, dp: 0, int: true }),
  drawdown_max_s: optNumber('The drawdown time', { min: 0, max: DURATION_MAX_S, dp: 0, int: true }),
  tds_min: optNumber('The TDS', { min: 0, max: 20, dp: 2 }, NUMBER_HELP.tds_min),
  tds_max: optNumber('The TDS', { min: 0, max: 20, dp: 2 }, NUMBER_HELP.tds_max),
  ey_min: optNumber('The extraction', { min: 0, max: 40, dp: 1 }, NUMBER_HELP.ey_min),
  ey_max: optNumber('The extraction', { min: 0, max: 40, dp: 1 }, NUMBER_HELP.ey_max),
  // steps
  steps_schema: z
    .literal(1)
    .nullish()
    .transform((): 1 => 1),
  steps: stepsSchema.nullish().transform((s) => s ?? []),
  notes: optText(LIMITS.notes, 'Notes'),
});

export const versionSchema = versionObject.superRefine((v, ctx) => {
  if (v.bypass_g > 0 && v.bypass_timing === 'none') {
    ctx.addIssue({
      code: 'custom',
      path: ['bypass_timing'],
      message: 'Choose when the bypass water goes in',
    });
  }
  if (v.bypass_g === 0 && v.bypass_timing !== 'none') {
    ctx.addIssue({
      code: 'custom',
      path: ['bypass_g'],
      message: 'Enter the bypass water, or choose None',
    });
  }
  rangeOrder(
    ctx,
    v.drawdown_min_s,
    v.drawdown_max_s,
    'drawdown_max_s',
    "The longest drawdown can't be shorter than the shortest",
  );
  rangeOrder(
    ctx,
    v.tds_min,
    v.tds_max,
    'tds_max',
    "The highest TDS can't be lower than the lowest",
  );
  rangeOrder(
    ctx,
    v.ey_min,
    v.ey_max,
    'ey_max',
    "The highest extraction can't be lower than the lowest",
  );
});

/** The values of one saved version, normalised: what goes to the RPC as `p_version`. */
export type VersionPayload = z.output<typeof versionSchema>;
/** What the form holds for a version before parsing (empty fields as null or ''). */
export type VersionInput = z.input<typeof versionSchema>;

// ---- recipe form ----------------------------------------------------------------------------

export const recipeFormSchema = z
  .object({
    name: z
      .string({ error: 'Enter a name for the recipe' })
      .trim()
      .min(1, 'Enter a name for the recipe')
      .max(LIMITS.name, `The name can be up to ${LIMITS.name} characters`),
    method: z.enum(BREW_METHODS, { error: 'Choose a method' }),
    method_custom: optText(METHOD_CUSTOM_MAX, 'The method name'),
    version: versionSchema,
  })
  .superRefine((r, ctx) => {
    if (r.method === 'other' && !r.method_custom) {
      ctx.addIssue({ code: 'custom', path: ['method_custom'], message: 'Name the method' });
    }
  })
  .transform((r) => ({ ...r, method_custom: r.method === 'other' ? r.method_custom : null }));

export type RecipeFormValues = z.output<typeof recipeFormSchema>;
export type RecipeFormInput = z.input<typeof recipeFormSchema>;

/** The arguments of `save_recipe` / `create_recipe` for a parsed recipe form. */
export function toRecipeRpcArgs(form: RecipeFormValues): {
  p_name: string;
  p_method: BrewMethod;
  p_method_custom: string | null;
  p_version: VersionPayload;
} {
  return {
    p_name: form.name,
    p_method: form.method,
    p_method_custom: form.method_custom,
    p_version: form.version,
  };
}

// ---- gear items and favourites --------------------------------------------------------------

export const gearItemFormSchema = z
  .object({
    category: z.enum(GEAR_CATEGORIES, { error: 'Choose a category' }),
    catalog_id: z
      .uuid()
      .nullish()
      .transform((v): string | null => v ?? null),
    custom_name: optText(LIMITS.gearName, 'The name'),
    nickname: optText(LIMITS.nickname, 'The nickname'),
    notes: optText(LIMITS.gearNotes, 'Notes'),
    is_default: z.boolean().default(false),
  })
  .superRefine((g, ctx) => {
    if (!g.catalog_id && !g.custom_name) {
      ctx.addIssue({
        code: 'custom',
        path: ['custom_name'],
        message: 'Choose an item from the list, or use your own name',
      });
    }
  })
  // A catalogue item and a custom name are alternatives: the catalogue wins.
  .transform((g) => ({ ...g, custom_name: g.catalog_id ? null : g.custom_name }));

export type GearItemFormValues = z.output<typeof gearItemFormSchema>;

/** A favourite linked to one of my gear items, kept in step by a database trigger. */
export const linkedFavouriteSchema = z.object({
  item_id: z.uuid(),
  category: z.enum(GEAR_CATEGORIES),
  name: z.string().trim().min(1).max(LIMITS.gearName),
});

/** An older free-text favourite from M2 (no `item_id`). */
export const legacyFavouriteSchema = z.object({
  category: z.enum(GEAR_CATEGORIES),
  name: z.string().trim().min(1).max(LIMITS.gearName),
});

export type LinkedFavourite = z.infer<typeof linkedFavouriteSchema>;
export type LegacyFavourite = z.infer<typeof legacyFavouriteSchema>;
