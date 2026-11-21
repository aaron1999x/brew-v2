import { z } from 'zod';
import { ERROR_MESSAGES } from '@/lib/errors/messages';
import { roundTo } from '@/lib/units';
import type { Database } from '@/types/database';
import type { StepData } from '@/lib/recipes/steps';
import { changeNote } from './change-note';
import { applyQuickChange, isNoChange, normalizeQuickChange, type QuickChangeBase } from './quick-change';
import type { TimerState } from './timer';

/**
 * One set of schemas for the brew log: the form, the quick change, the save payload and the
 * brew session kept on the device. Limits mirror the database (migrations 20261113000001 and
 * 20261120000002). Stored values are metric.
 */

export type BrewMethod = Database['public']['Enums']['brew_method'];
export type TastedTemp = Database['public']['Enums']['tasted_temp'];
export type BrewSource = Database['public']['Enums']['brew_source'];

export const BREW_LIMITS = {
  flavoursMax: 12,
  flavourMax: 30,
  notesMax: 5000,
  nextChangeMax: 1000,
  grindMax: 40,
  drawdownMaxS: 7200,
  beverageMaxG: 3000,
  tdsMaxPct: 20,
  tastedAfterMaxMin: 240,
  doseMaxG: 200,
  brewWaterMaxG: 3000,
  /** A brew can be dated at most this far ahead (the database allows 5 minutes of drift). */
  futureToleranceMs: 60_000,
} as const;

/**
 * The seven attribute scores in the prototype's order. They start at 5.0 and every brew saves all
 * seven; the radar shows these only. Overall is separate (below): it starts empty and is required.
 */
export const ATTRIBUTE_KEYS = [
  'sweetness',
  'acidity',
  'brightness',
  'body',
  'clarity',
  'balance',
  'aftertaste',
] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

/** The attributes and then overall: for tables and text alternatives. */
export const TASTE_KEYS = [...ATTRIBUTE_KEYS, 'overall'] as const;
export type TasteKey = (typeof TASTE_KEYS)[number];

/** Where every attribute slider starts. */
export const DEFAULT_ATTRIBUTE_SCORE = 5;

export const TASTE_LABELS: Record<TasteKey, string> = {
  sweetness: 'Sweetness',
  acidity: 'Acidity',
  brightness: 'Brightness',
  body: 'Body',
  clarity: 'Clarity',
  balance: 'Balance',
  aftertaste: 'Aftertaste',
  overall: 'Overall',
};

/** The prototype's flavour tag presets (FlavourTags in Brews.tsx). */
export const PRESET_FLAVOURS = [
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
] as const;

export const TASTED_TEMPS = ['hot', 'warm', 'cool'] as const satisfies readonly TastedTemp[];

// ---- flavours -------------------------------------------------------------------------------

const flavourKey = (tag: string) => tag.trim().toLowerCase();

/** Trims, drops empty tags and duplicates (ignoring case), keeps the first spelling. */
export function normalizeFlavours(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag || seen.has(flavourKey(tag))) continue;
    seen.add(flavourKey(tag));
    out.push(tag);
  }
  return out;
}

export type AddFlavourResult =
  | { ok: true; tags: string[] }
  | { ok: false; reason: 'empty' | 'too_long' | 'too_many' | 'duplicate'; tags: string[] };

/** Adds a tag typed by the person, with the limits the database has. */
export function addFlavour(tags: readonly string[], text: string): AddFlavourResult {
  const tag = text.trim();
  if (!tag) return { ok: false, reason: 'empty', tags: [...tags] };
  if (tag.length > BREW_LIMITS.flavourMax) return { ok: false, reason: 'too_long', tags: [...tags] };
  if (tags.some((t) => flavourKey(t) === flavourKey(tag))) {
    return { ok: false, reason: 'duplicate', tags: [...tags] };
  }
  if (tags.length >= BREW_LIMITS.flavoursMax) return { ok: false, reason: 'too_many', tags: [...tags] };
  return { ok: true, tags: [...tags, tag] };
}

const flavoursSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'A flavour tag can’t be empty')
      .max(BREW_LIMITS.flavourMax, `A flavour tag can be up to ${BREW_LIMITS.flavourMax} characters`),
  )
  .max(BREW_LIMITS.flavoursMax, `Choose up to ${BREW_LIMITS.flavoursMax} flavours`)
  .refine((tags) => new Set(tags.map(flavourKey)).size === tags.length, 'Each flavour can be added once');

// ---- quick change ---------------------------------------------------------------------------

/**
 * "Change for this brew": only the fields that were changed are present. Absent means "as the
 * version has it"; `grindSetting: null` and `tempC: null` mean "cleared".
 */
export const quickChangeSchema = z.object({
  // Plain text, kept exactly as typed: no trim here, or a space typed between words would vanish
  // when the saved session is read back ("24 clicks" would become "24clicks").
  grindSetting: z
    .string()
    .max(BREW_LIMITS.grindMax, `Grind setting can be up to ${BREW_LIMITS.grindMax} characters`)
    .nullable()
    .optional(),
  tempC: z.number().min(0).max(100).nullable().optional(),
  doseG: z.number().gt(0).max(BREW_LIMITS.doseMaxG).optional(),
  brewWaterG: z.number().gt(0).max(BREW_LIMITS.brewWaterMaxG).optional(),
});
export type QuickChange = z.infer<typeof quickChangeSchema>;

// ---- the log form ---------------------------------------------------------------------------

const attribute = z
  .number()
  .min(0, 'Scores go from 0 to 10')
  .max(10, 'Scores go from 0 to 10')
  .refine((n) => Number.isInteger(n * 2), 'Scores go in steps of 0.5');
const score = attribute.nullable();

/** All values are metric. `overall` is null until scored; saving needs it. */
export function brewLogFormSchema(now: number = Date.now()) {
  return z.object({
    brewedAt: z.string().superRefine((s, ctx) => {
      const time = Date.parse(s);
      if (Number.isNaN(time)) {
        ctx.addIssue({ code: 'custom', message: 'Enter when you brewed' });
      } else if (time > now + BREW_LIMITS.futureToleranceMs) {
        ctx.addIssue({ code: 'custom', message: 'The brew time can’t be in the future' });
      }
    }),
    drawdownS: z
      .number()
      .int('Drawdown is a whole number of seconds')
      .min(0)
      .max(BREW_LIMITS.drawdownMaxS, 'Drawdown can be up to 2 hours')
      .nullable(),
    beverageG: z.number().min(0).max(BREW_LIMITS.beverageMaxG, 'That beverage weight is too high').nullable(),
    tdsPct: z.number().min(0, 'TDS is between 0 and 20%').max(BREW_LIMITS.tdsMaxPct, 'TDS is between 0 and 20%').nullable(),
    sweetness: attribute,
    acidity: attribute,
    brightness: attribute,
    body: attribute,
    clarity: attribute,
    balance: attribute,
    aftertaste: attribute,
    // An explicit boolean return, so TypeScript doesn't infer a type guard that narrows overall to number.
    overall: score.refine((n): boolean => n != null, ERROR_MESSAGES.overall_required),
    flavours: flavoursSchema,
    tastedTemp: z.enum(TASTED_TEMPS).nullable(),
    tastedAfterMin: z
      .number()
      .int('Minutes are a whole number')
      .min(0, 'Minutes after brewing: 0 to 240')
      .max(BREW_LIMITS.tastedAfterMaxMin, 'Minutes after brewing: 0 to 240')
      .nullable(),
    notes: z.string().max(BREW_LIMITS.notesMax, `Notes can be up to ${BREW_LIMITS.notesMax} characters`),
    nextChange: z
      .string()
      .max(BREW_LIMITS.nextChangeMax, `This note can be up to ${BREW_LIMITS.nextChangeMax} characters`),
  });
}
export type BrewLogForm = z.infer<ReturnType<typeof brewLogFormSchema>>;

export const FORM_FIELDS = Object.keys(brewLogFormSchema().shape) as (keyof BrewLogForm)[];

/** A fresh form: the seven attributes at 5.0, overall not scored, nothing else filled in. */
export function emptyBrewLogForm(brewedAt: string): BrewLogForm {
  return {
    brewedAt,
    drawdownS: null,
    beverageG: null,
    tdsPct: null,
    sweetness: DEFAULT_ATTRIBUTE_SCORE,
    acidity: DEFAULT_ATTRIBUTE_SCORE,
    brightness: DEFAULT_ATTRIBUTE_SCORE,
    body: DEFAULT_ATTRIBUTE_SCORE,
    clarity: DEFAULT_ATTRIBUTE_SCORE,
    balance: DEFAULT_ATTRIBUTE_SCORE,
    aftertaste: DEFAULT_ATTRIBUTE_SCORE,
    overall: null,
    flavours: [],
    tastedTemp: null,
    tastedAfterMin: null,
    notes: '',
    nextChange: '',
  };
}

export type BrewIssue = { field: keyof BrewLogForm | 'form'; message: string };
export type BrewValidation = { ok: true; data: BrewLogForm } | { ok: false; issues: BrewIssue[] };

/** Validates the form for saving; issues come in form order, for the error summary. */
export function validateBrewLog(input: unknown, now: number = Date.now()): BrewValidation {
  const parsed = brewLogFormSchema(now).safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issues: BrewIssue[] = parsed.error.issues.map((issue) => {
    const head = issue.path[0];
    const field = typeof head === 'string' && (FORM_FIELDS as string[]).includes(head) ? (head as keyof BrewLogForm) : 'form';
    return { field, message: issue.message };
  });
  issues.sort((a, b) => FORM_FIELDS.indexOf(a.field as never) - FORM_FIELDS.indexOf(b.field as never));
  return { ok: false, issues };
}

// ---- the save payload -----------------------------------------------------------------------

/** What `log_brew(p_brew, p_new_version)` takes. Weights are rounded to the columns' precision. */
export type LogBrewBrew = {
  id: string;
  recipe_version_id: string;
  brewed_at: string;
  source: BrewSource;
  drawdown_s: number | null;
  beverage_g: number | null;
  tds_pct: number | null;
  sweetness: number | null;
  acidity: number | null;
  brightness: number | null;
  body: number | null;
  clarity: number | null;
  balance: number | null;
  aftertaste: number | null;
  overall: number;
  flavours: string[];
  tasted_temp: TastedTemp | null;
  tasted_after_min: number | null;
  notes: string | null;
  next_change: string | null;
  client_updated_at: string;
};

export type LogBrewNewVersion = {
  grind_setting: string | null;
  temp_c: number | null;
  dose_g: number;
  brew_water_g: number;
  steps: StepData[];
  change_note: string;
};

export type LogBrewPayload = { brew: LogBrewBrew; newVersion: LogBrewNewVersion | null };

const orNull = (text: string): string | null => (text.trim() === '' ? null : text);

/**
 * The arguments for `log_brew`. A quick change that really changes something becomes the
 * `newVersion` (the changed values, the scaled steps and the generated change note); otherwise it is null.
 * Throws if `form.overall` is missing: validate first.
 */
export function toLogBrewPayload(input: {
  sessionId: string;
  versionId: string;
  base: QuickChangeBase;
  quickChange: QuickChange | null | undefined;
  form: BrewLogForm;
  timerUsed: boolean;
  units: Parameters<typeof changeNote>[2];
  now?: Date;
}): LogBrewPayload {
  const { form } = input;
  if (form.overall == null) throw new Error('overall_required');
  const brew: LogBrewBrew = {
    id: input.sessionId,
    recipe_version_id: input.versionId,
    brewed_at: new Date(form.brewedAt).toISOString(),
    source: input.timerUsed ? 'timer' : 'manual',
    drawdown_s: form.drawdownS,
    beverage_g: form.beverageG == null ? null : roundTo(form.beverageG, 1),
    tds_pct: form.tdsPct == null ? null : roundTo(form.tdsPct, 2),
    sweetness: form.sweetness,
    acidity: form.acidity,
    brightness: form.brightness,
    body: form.body,
    clarity: form.clarity,
    balance: form.balance,
    aftertaste: form.aftertaste,
    overall: form.overall,
    flavours: normalizeFlavours(form.flavours),
    tasted_temp: form.tastedTemp,
    tasted_after_min: form.tastedAfterMin,
    notes: orNull(form.notes),
    next_change: orNull(form.nextChange),
    client_updated_at: (input.now ?? new Date()).toISOString(),
  };

  const change = input.quickChange ? normalizeQuickChange(input.base, input.quickChange) : null;
  if (!change || isNoChange(input.base, change)) return { brew, newVersion: null };
  const applied = applyQuickChange(input.base, change);
  return {
    brew,
    newVersion: {
      grind_setting: applied.grind_setting,
      temp_c: applied.temp_c,
      dose_g: applied.dose_g,
      brew_water_g: applied.brew_water_g,
      steps: [...applied.steps],
      change_note: changeNote(input.base, change, input.units),
    },
  };
}

// ---- the brew session kept on the device ----------------------------------------------------

/** Tolerant of a bad value inside a saved draft: that field is just dropped. */
const lenient = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

/** The form as saved while it is being filled in: every field optional, nothing validated yet. */
export const brewLogDraftSchema = z.object({
  brewedAt: lenient(z.string()),
  drawdownS: lenient(z.number().nullable()),
  beverageG: lenient(z.number().nullable()),
  tdsPct: lenient(z.number().nullable()),
  sweetness: lenient(z.number().nullable()),
  acidity: lenient(z.number().nullable()),
  brightness: lenient(z.number().nullable()),
  body: lenient(z.number().nullable()),
  clarity: lenient(z.number().nullable()),
  balance: lenient(z.number().nullable()),
  aftertaste: lenient(z.number().nullable()),
  overall: lenient(z.number().nullable()),
  flavours: lenient(z.array(z.string())),
  tastedTemp: lenient(z.enum(TASTED_TEMPS).nullable()),
  tastedAfterMin: lenient(z.number().nullable()),
  notes: lenient(z.string()),
  nextChange: lenient(z.string()),
});
export type BrewLogDraft = z.infer<typeof brewLogDraftSchema>;

/** A saved step, read back loosely: unknown keys are kept so the steps match the database exactly. */
const sessionStepSchema = z.looseObject({
  id: z.string(),
  kind: z.enum(['pour', 'wait', 'swirl', 'stir', 'press', 'other']),
  at_s: z.number(),
  duration_s: z.number().nullable().optional(),
  target_g: z.number().nullable().optional(),
  rate_gps: z.number().nullable().optional(),
  temp_c: z.number().nullable().optional(),
  label: z.string().nullable().optional(),
  technique: z.string().nullable().optional(),
});

/** What the timer and the log need to know about the version, copied when the session starts. */
export const sessionVersionSchema = z.object({
  dose_g: z.number(),
  brew_water_g: z.number(),
  bypass_g: z.number(),
  retention_ratio: z.number().nullable(),
  temp_c: z.number().nullable(),
  grind_setting: z.string().nullable(),
  /** Optional: sessions saved before this field existed don't have it. */
  grind_microns: z.number().nullable().optional(),
  grinder: z.string().nullable(),
  drawdown_min_s: z.number().nullable(),
  drawdown_max_s: z.number().nullable(),
  tds_min: z.number().nullable(),
  tds_max: z.number().nullable(),
  ey_min: z.number().nullable(),
  ey_max: z.number().nullable(),
  steps: z.array(sessionStepSchema),
});
export type SessionVersion = Omit<z.infer<typeof sessionVersionSchema>, 'steps'> & { steps: StepData[] };

export const timerStateSchema: z.ZodType<TimerState> = z.object({
  mode: z.enum(['guided', 'steep', 'stopwatch']),
  phase: z.enum(['prep', 'countin', 'running', 'paused', 'finishing', 'done']),
  endS: z.number().nullable(),
  countinStartedAt: z.number().nullable(),
  startedAt: z.number().nullable(),
  pausedAt: z.number().nullable(),
  pausedTotalMs: z.number(),
  seenS: z.number(),
  finishedS: z.number().nullable(),
  drawdownS: z.number().nullable(),
  ended: z.enum(['finished', 'log_anyway']).nullable(),
});

export const brewMethodSchema = z.enum([
  'pour_over',
  'immersion',
  'hybrid',
  'aeropress',
  'french_press',
  'siphon',
  'cold_brew',
  'other',
]);

export const brewSessionSchema = z.object({
  v: z.literal(1),
  /** Becomes `brews.id`, so a retried save is the same brew. */
  id: z.uuid(),
  userId: z.string(),
  recipeId: z.string(),
  versionId: z.string(),
  versionNo: z.number().int(),
  /** The recipe's latest version when the session started: a quick change saves as latest + 1. */
  latestVersionNo: z.number().int(),
  handle: z.string(),
  slug: z.string(),
  recipeName: z.string(),
  method: brewMethodSchema,
  /** How the person chose to brew: with the guided timer, or log only. */
  entry: z.enum(['timer', 'log']),
  version: sessionVersionSchema,
  quickChange: quickChangeSchema.nullable(),
  timer: timerStateSchema.nullable(),
  form: brewLogDraftSchema.nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type BrewSession = Omit<z.infer<typeof brewSessionSchema>, 'version'> & { version: SessionVersion };
