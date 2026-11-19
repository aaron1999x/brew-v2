import { buildGear, defaultGearSelection, type GearItem, type GearSelection } from './gear';
import type { BrewMethod, BypassTiming, RoastLevel } from './methods';
import { recipeFormSchema, type RecipeFormInput, type RecipeFormValues } from './schema';
import { clearPourTemperatures, type StepData } from './steps';

/**
 * What the recipe editor holds while it is being filled in. Text fields are plain strings (empty
 * means "not set"), numbers are metric values or null, steps are the loose `StepData` the step
 * editor works on. `parseDraft` turns it into the values `create_recipe` / `save_recipe` take, or
 * into errors that name the editor field each problem belongs to.
 */
export type RecipeDraft = {
  name: string;
  method: BrewMethod | null;
  method_custom: string;
  gear: GearSelection;
  // coffee
  coffee_name: string;
  roaster: string;
  origin: string;
  process: string;
  varietal: string;
  altitude_m: number | null;
  roast_level: RoastLevel | null;
  /** YYYY-MM-DD, never converted through a time zone. */
  roast_date: string | null;
  colour_reading: number | null;
  colour_scale: string;
  // numbers
  dose_g: number | null;
  brew_water_g: number | null;
  bypass_g: number | null;
  bypass_timing: BypassTiming;
  retention_ratio: number | null;
  temp_c: number | null;
  grind_setting: string;
  grind_microns: number | null;
  water_ppm: number | null;
  // steps
  steps: StepData[];
  /** "Vary temperature by pour": while off, pour temperatures are dropped on save. */
  vary_temp: boolean;
  // targets
  drawdown_min_s: number | null;
  drawdown_max_s: number | null;
  tds_min: number | null;
  tds_max: number | null;
  ey_min: number | null;
  ey_max: number | null;
  notes: string;
};

/** A new recipe: nothing filled in, my default gear in each category. */
export function emptyDraft(gearItems: readonly GearItem[] = []): RecipeDraft {
  return {
    name: '',
    method: null,
    method_custom: '',
    gear: defaultGearSelection(gearItems),
    coffee_name: '',
    roaster: '',
    origin: '',
    process: '',
    varietal: '',
    altitude_m: null,
    roast_level: null,
    roast_date: null,
    colour_reading: null,
    colour_scale: '',
    dose_g: null,
    brew_water_g: null,
    bypass_g: null,
    bypass_timing: 'none',
    retention_ratio: null,
    temp_c: null,
    grind_setting: '',
    grind_microns: null,
    water_ppm: null,
    steps: [],
    vary_temp: false,
    drawdown_min_s: null,
    drawdown_max_s: null,
    tds_min: null,
    tds_max: null,
    ey_min: null,
    ey_max: null,
    notes: '',
  };
}

/** The shape `recipeFormSchema` parses. Empty text and unset numbers go in as they are. */
export function draftToFormInput(draft: RecipeDraft): RecipeFormInput {
  const { gear, brewer_catalog_id, grinder_catalog_id } = buildGear(draft.gear);
  const steps = draft.vary_temp ? draft.steps : clearPourTemperatures(draft.steps);
  return {
    name: draft.name,
    method: draft.method as BrewMethod,
    method_custom: draft.method_custom,
    version: {
      coffee_name: draft.coffee_name,
      roaster: draft.roaster,
      origin: draft.origin,
      process: draft.process,
      varietal: draft.varietal,
      altitude_m: draft.altitude_m,
      roast_level: draft.roast_level,
      roast_date: draft.roast_date,
      colour_reading: draft.colour_reading,
      colour_scale: draft.colour_scale,
      gear,
      brewer_catalog_id,
      grinder_catalog_id,
      dose_g: draft.dose_g as number,
      brew_water_g: draft.brew_water_g as number,
      bypass_g: draft.bypass_g,
      bypass_timing: draft.bypass_timing,
      retention_ratio: draft.retention_ratio,
      temp_c: draft.temp_c,
      grind_setting: draft.grind_setting,
      grind_microns: draft.grind_microns,
      water_ppm: draft.water_ppm,
      drawdown_min_s: draft.drawdown_min_s,
      drawdown_max_s: draft.drawdown_max_s,
      tds_min: draft.tds_min,
      tds_max: draft.tds_max,
      ey_min: draft.ey_min,
      ey_max: draft.ey_max,
      steps_schema: 1,
      steps: steps as never,
      notes: draft.notes,
    },
  };
}

// ---- field ids ------------------------------------------------------------------------------

/** The id of an editor field: `recipe-dose-g` for `dose_g`. The error summary links to these. */
export function fieldId(key: string): string {
  return `recipe-${key.replace(/_/g, '-')}`;
}

/** The id of one field of one step: `step-<id>-target_g`. */
export function stepFieldId(stepId: string, field: string): string {
  return `step-${stepId}-${field}`;
}

export const STEPS_ADD_ID = 'steps-add';

export type DraftError = { fieldId: string; message: string };

/** The editor field a Zod issue belongs to. */
export function issueFieldId(path: readonly PropertyKey[], steps: readonly StepData[]): string {
  const [first, second, third, fourth] = path.map(String);
  if (first !== 'version') return fieldId(first ?? 'name');
  if (second === 'steps') {
    const step = third == null ? undefined : steps[Number(third)];
    if (!step) return STEPS_ADD_ID;
    return stepFieldId(step.id, fourth ?? 'at_s');
  }
  // Gear is built from pickers that can't be invalid; anything else lands on the field's own id.
  return fieldId(second ?? 'name');
}

export type ParsedDraft =
  { ok: true; values: RecipeFormValues } | { ok: false; errors: DraftError[] };

/** Validates a draft. Errors are one per field (the first message wins), in the schema's order. */
export function parseDraft(draft: RecipeDraft): ParsedDraft {
  const result = recipeFormSchema.safeParse(draftToFormInput(draft));
  if (result.success) return { ok: true, values: result.data };
  const seen = new Set<string>();
  const errors: DraftError[] = [];
  for (const issue of result.error.issues) {
    const id = issueFieldId(issue.path, draft.steps);
    if (seen.has(id)) continue;
    seen.add(id);
    errors.push({ fieldId: id, message: issue.message });
  }
  return { ok: false, errors };
}

/** Parsed values, for "did anything change?" (null while the draft doesn't parse yet). */
export function draftSignature(draft: RecipeDraft): string {
  return JSON.stringify(draft);
}

// ---- the copy kept on this device -----------------------------------------------------------

export const DEVICE_DRAFT_KEY = 'recipe-draft:new';

/** Saves the draft on this device so an iOS reload doesn't lose it. Never throws. */
export function saveDeviceDraft(draft: RecipeDraft, key: string = DEVICE_DRAFT_KEY): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), draft }));
  } catch {
    // Storage can be full or blocked (private windows): the editor works without it.
  }
}

export function loadDeviceDraft(key: string = DEVICE_DRAFT_KEY): RecipeDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { draft?: RecipeDraft };
    const draft = parsed.draft;
    if (!draft || typeof draft !== 'object' || !Array.isArray(draft.steps)) return null;
    // Fill in anything a newer editor added, so an older draft still opens.
    return { ...emptyDraft(), ...draft };
  } catch {
    return null;
  }
}

export function clearDeviceDraft(key: string = DEVICE_DRAFT_KEY): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}
