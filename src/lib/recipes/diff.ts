import { RECIPE_GEAR_CATEGORIES, GEAR_CATEGORY_LABELS } from './gear';
import { methodLabel, type BrewMethod } from './methods';
import { versionSchema, type VersionPayload } from './schema';
import { stepLabel, type StepData } from './steps';

/**
 * The difference between two versions of a recipe. One pure function feeds both the compare page
 * and the editor's "3 fields changed" summary, so they can never disagree.
 *
 * Inputs are normalised payloads (parse them with `versionSchema` first; {@link versionDiffInput}
 * does that for a database row). Values are metric and unit-independent: switching to °F and oz
 * changes how a diff is shown, never what it contains. `change_note` is not compared: it
 * describes the new version rather than being one of its settings.
 */

export const DIFF_SECTIONS = [
  'basics',
  'gear',
  'coffee',
  'numbers',
  'steps',
  'targets',
  'notes',
] as const;
export type DiffSection = (typeof DIFF_SECTIONS)[number];

export const DIFF_SECTION_LABELS: Record<DiffSection, string> = {
  basics: 'Basics',
  gear: 'Gear',
  coffee: 'Coffee',
  numbers: 'Numbers',
  steps: 'Steps',
  targets: 'Targets',
  notes: 'Notes',
};

/** How the UI should format a value: weights, temperatures and times follow the user's units. */
export type ValueType =
  | 'text'
  | 'integer'
  | 'decimal'
  | 'weight'
  | 'temperature'
  | 'duration'
  | 'rate'
  | 'percent'
  | 'date'
  | 'ratio';

export type DiffValue = string | number | null;

export type FieldChange = {
  section: Exclude<DiffSection, 'steps'>;
  /** Stable key, for example `numbers.dose_g`; used to highlight the matching field. */
  key: string;
  label: string;
  type: ValueType;
  before: DiffValue;
  after: DiffValue;
};

export type StepFieldChange = {
  key: keyof StepData;
  label: string;
  type: ValueType;
  before: DiffValue;
  after: DiffValue;
};

export type StepChange = {
  id: string;
  change: 'added' | 'removed' | 'moved' | 'changed';
  /** "Pour 2", "Close valve": named from the version the step exists in (the newer one if both). */
  label: string;
  /** 1-based position in version A (null when added) and in version B (null when removed). */
  fromPosition: number | null;
  toPosition: number | null;
  /** True when the step also changed place (a "changed" step can be moved too). */
  moved: boolean;
  fields: StepFieldChange[];
  before: StepData | null;
  after: StepData | null;
};

export type VersionDiff = {
  fields: FieldChange[];
  steps: StepChange[];
  /** Changed fields plus changed steps: the "3 fields changed" number. */
  count: number;
  sections: Record<DiffSection, { changed: boolean; count: number }>;
  /** Keys of changed fields, for highlighting. */
  changedKeys: ReadonlySet<string>;
};

/** A version plus the recipe-level fields that the editor can change with it. */
export type DiffInput = Partial<Omit<VersionPayload, 'steps'>> & {
  steps?: readonly StepData[];
  name?: string;
  method?: BrewMethod;
  method_custom?: string | null;
};

type FieldSpec = {
  section: Exclude<DiffSection, 'steps'>;
  field: keyof VersionPayload;
  label: string;
  type: ValueType;
};

const FIELD_SPECS: readonly FieldSpec[] = [
  { section: 'coffee', field: 'coffee_name', label: 'Coffee name', type: 'text' },
  { section: 'coffee', field: 'roaster', label: 'Roaster', type: 'text' },
  { section: 'coffee', field: 'origin', label: 'Origin', type: 'text' },
  { section: 'coffee', field: 'process', label: 'Process', type: 'text' },
  { section: 'coffee', field: 'varietal', label: 'Varietal', type: 'text' },
  { section: 'coffee', field: 'altitude_m', label: 'Altitude', type: 'integer' },
  { section: 'coffee', field: 'roast_level', label: 'Roast level', type: 'text' },
  { section: 'coffee', field: 'roast_date', label: 'Roast date', type: 'date' },
  { section: 'coffee', field: 'colour_reading', label: 'Colour reading', type: 'decimal' },
  { section: 'coffee', field: 'colour_scale', label: 'Colour scale', type: 'text' },
  { section: 'numbers', field: 'dose_g', label: 'Dose', type: 'weight' },
  { section: 'numbers', field: 'brew_water_g', label: 'Brew water', type: 'weight' },
  { section: 'numbers', field: 'bypass_g', label: 'Bypass', type: 'weight' },
  { section: 'numbers', field: 'bypass_timing', label: 'Bypass timing', type: 'text' },
  { section: 'numbers', field: 'temp_c', label: 'Temperature', type: 'temperature' },
  { section: 'numbers', field: 'grind_setting', label: 'Grind setting', type: 'text' },
  { section: 'numbers', field: 'grind_microns', label: 'Grind size', type: 'integer' },
  { section: 'numbers', field: 'water_ppm', label: 'Water', type: 'integer' },
  { section: 'numbers', field: 'retention_ratio', label: 'Retention', type: 'ratio' },
  { section: 'targets', field: 'drawdown_min_s', label: 'Drawdown, shortest', type: 'duration' },
  { section: 'targets', field: 'drawdown_max_s', label: 'Drawdown, longest', type: 'duration' },
  { section: 'targets', field: 'tds_min', label: 'TDS, lowest', type: 'percent' },
  { section: 'targets', field: 'tds_max', label: 'TDS, highest', type: 'percent' },
  { section: 'targets', field: 'ey_min', label: 'Extraction, lowest', type: 'percent' },
  { section: 'targets', field: 'ey_max', label: 'Extraction, highest', type: 'percent' },
  { section: 'notes', field: 'notes', label: 'Notes', type: 'text' },
];

const STEP_FIELDS: readonly { key: keyof StepData; label: string; type: ValueType }[] = [
  { key: 'kind', label: 'Kind', type: 'text' },
  { key: 'at_s', label: 'Time', type: 'duration' },
  { key: 'duration_s', label: 'Duration', type: 'duration' },
  { key: 'target_g', label: 'Weight', type: 'weight' },
  { key: 'rate_gps', label: 'Rate', type: 'rate' },
  { key: 'temp_c', label: 'Temperature', type: 'temperature' },
  { key: 'label', label: 'Label', type: 'text' },
  { key: 'technique', label: 'Technique', type: 'text' },
];

const empty = (): DiffValue => null;

/** undefined, null and empty text are all "not set". */
function norm(value: unknown): DiffValue {
  if (value === undefined || value === null || value === '') return empty();
  return value as string | number;
}

/** Positions of the longest run of ids that appear in the same order in both lists. */
function stableIds(a: readonly string[], b: readonly string[]): Set<string> {
  const n = a.length;
  const m = b.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i]![j] =
        a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const stable = new Set<string>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      stable.add(a[i]!);
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      i++;
    } else {
      j++;
    }
  }
  return stable;
}

function diffSteps(aSteps: readonly StepData[], bSteps: readonly StepData[]): StepChange[] {
  const aIndex = new Map(aSteps.map((s, i) => [s.id, i]));
  const bIndex = new Map(bSteps.map((s, i) => [s.id, i]));
  const common = (ids: readonly StepData[], other: Map<string, number>) =>
    ids.filter((s) => other.has(s.id)).map((s) => s.id);
  const stable = stableIds(common(aSteps, bIndex), common(bSteps, aIndex));

  const changes: StepChange[] = [];

  // Walk version B's order (what the newer version looks like), then add what was removed.
  bSteps.forEach((after, toIdx) => {
    const fromIdx = aIndex.get(after.id);
    if (fromIdx === undefined) {
      changes.push({
        id: after.id,
        change: 'added',
        label: stepLabel(bSteps, toIdx),
        fromPosition: null,
        toPosition: toIdx + 1,
        moved: false,
        fields: [],
        before: null,
        after,
      });
      return;
    }
    const before = aSteps[fromIdx]!;
    const fields: StepFieldChange[] = [];
    for (const spec of STEP_FIELDS) {
      const x = norm(before[spec.key]);
      const y = norm(after[spec.key]);
      if (x !== y)
        fields.push({ key: spec.key, label: spec.label, type: spec.type, before: x, after: y });
    }
    const moved = !stable.has(after.id);
    if (!moved && fields.length === 0) return;
    changes.push({
      id: after.id,
      change: fields.length > 0 ? 'changed' : 'moved',
      label: stepLabel(bSteps, toIdx),
      fromPosition: fromIdx + 1,
      toPosition: toIdx + 1,
      moved,
      fields,
      before,
      after,
    });
  });

  aSteps.forEach((before, fromIdx) => {
    if (bIndex.has(before.id)) return;
    changes.push({
      id: before.id,
      change: 'removed',
      label: stepLabel(aSteps, fromIdx),
      fromPosition: fromIdx + 1,
      toPosition: null,
      moved: false,
      fields: [],
      before,
      after: null,
    });
  });

  return changes;
}

export function diffVersions(a: DiffInput, b: DiffInput): VersionDiff {
  const fields: FieldChange[] = [];
  const push = (change: Omit<FieldChange, 'key'> & { field: string }) => {
    const { field, ...rest } = change;
    if (rest.before !== rest.after) fields.push({ ...rest, key: `${rest.section}.${field}` });
  };

  // Basics: the recipe name and method (a custom method name counts as part of the method).
  push({
    section: 'basics',
    field: 'name',
    label: 'Name',
    type: 'text',
    before: norm(a.name),
    after: norm(b.name),
  });
  const methodOf = (v: DiffInput): DiffValue =>
    v.method ? methodLabel(v.method, v.method_custom) : empty();
  push({
    section: 'basics',
    field: 'method',
    label: 'Method',
    type: 'text',
    before: methodOf(a),
    after: methodOf(b),
  });

  // Gear: compared by the name saved on each version, one field per category.
  for (const category of RECIPE_GEAR_CATEGORIES) {
    push({
      section: 'gear',
      field: category,
      label: GEAR_CATEGORY_LABELS[category],
      type: 'text',
      before: norm(a.gear?.[category]?.name),
      after: norm(b.gear?.[category]?.name),
    });
  }

  for (const spec of FIELD_SPECS) {
    push({
      section: spec.section,
      field: spec.field,
      label: spec.label,
      type: spec.type,
      before: norm(a[spec.field]),
      after: norm(b[spec.field]),
    });
  }

  const steps = diffSteps(a.steps ?? [], b.steps ?? []);

  const sections = Object.fromEntries(
    DIFF_SECTIONS.map((s) => {
      const count = s === 'steps' ? steps.length : fields.filter((f) => f.section === s).length;
      return [s, { changed: count > 0, count }];
    }),
  ) as VersionDiff['sections'];

  return {
    fields,
    steps,
    count: fields.length + steps.length,
    sections,
    changedKeys: new Set(fields.map((f) => f.key)),
  };
}

/**
 * A recipe and one of its stored versions as a {@link DiffInput}: the row is parsed with the same
 * schema as the form, so a saved version and the editor's values are normalised the same way.
 */
export function versionDiffInput(
  recipe: { name: string; method: BrewMethod; method_custom?: string | null },
  versionRow: Record<string, unknown>,
): DiffInput {
  return {
    name: recipe.name,
    method: recipe.method,
    method_custom: recipe.method_custom ?? null,
    ...versionSchema.parse(versionRow),
  };
}
