import { formatRatio, brewRatio } from '@/lib/recipes/calc';
import { ATTRIBUTE_KEYS, TASTE_LABELS } from './schema';

/** A brew as the compare page needs it: the brew row and the numbers of the version it used. */
export type CompareBrew = {
  id: string;
  recipe_name_snapshot: string;
  version_no_snapshot: number;
  brewed_at: string;
  dose_g_snapshot: number;
  drawdown_s: number | null;
  beverage_g: number | null;
  tds_pct: number | null;
  ey_pct: number | null;
  sweetness: number | null;
  acidity: number | null;
  brightness: number | null;
  body: number | null;
  clarity: number | null;
  balance: number | null;
  aftertaste: number | null;
  overall: number;
  flavours: string[];
  /** Null when the version is gone. */
  version: {
    brew_water_g: number;
    temp_c: number | null;
    grind_setting: string | null;
  } | null;
};

export type CompareGroup = 'Setup' | 'Results' | 'Sensory';
export type CompareRow = {
  group: CompareGroup;
  label: string;
  values: string[];
  /** The brews don't all have the same value: marked with an icon and the word "differs". */
  differs: boolean;
};

/** The three markers of a brew in the compare view: a letter, so it never relies on colour. */
export const COMPARE_LETTERS = ['A', 'B', 'C'] as const;

export type CompareFormat = {
  weight: (grams: number) => string;
  temp: (celsius: number) => string;
  duration: (seconds: number) => string;
  dateTime: (iso: string) => string;
};

const DASH = '—';
const score = (n: number | null) => (n == null ? DASH : n.toFixed(1));

/**
 * The side-by-side table, grouped like the prototype's Compare page: setup, results and sensory.
 * Every value is already formatted in the person's units, so "differs" compares what is shown.
 */
export function buildCompareRows(brews: readonly CompareBrew[], fmt: CompareFormat): CompareRow[] {
  const row = (group: CompareGroup, label: string, get: (b: CompareBrew) => string): CompareRow => {
    const values = brews.map(get);
    return { group, label, values, differs: new Set(values).size > 1 };
  };
  return [
    row('Setup', 'Recipe', (b) => `${b.recipe_name_snapshot} · v${b.version_no_snapshot}`),
    row('Setup', 'Brewed at', (b) => fmt.dateTime(b.brewed_at)),
    row('Setup', 'Dose', (b) => fmt.weight(b.dose_g_snapshot)),
    row('Setup', 'Brew water', (b) => (b.version ? fmt.weight(b.version.brew_water_g) : DASH)),
    row('Setup', 'Grind', (b) => b.version?.grind_setting || DASH),
    row('Setup', 'Temperature', (b) => (b.version?.temp_c != null ? fmt.temp(b.version.temp_c) : DASH)),
    row('Results', 'Brew ratio', (b) =>
      formatRatio(brewRatio(b.dose_g_snapshot, b.version?.brew_water_g ?? null)) ?? DASH,
    ),
    row('Results', 'Drawdown', (b) => (b.drawdown_s != null ? fmt.duration(b.drawdown_s) : DASH)),
    row('Results', 'Beverage weight', (b) => (b.beverage_g != null ? fmt.weight(b.beverage_g) : DASH)),
    row('Results', 'TDS', (b) => (b.tds_pct != null ? `${b.tds_pct}%` : DASH)),
    row('Results', 'Extraction', (b) => (b.ey_pct != null ? `${b.ey_pct}%` : DASH)),
    ...ATTRIBUTE_KEYS.map((key) => row('Sensory', TASTE_LABELS[key], (b) => score(b[key]))),
    // Overall is the headline: a row of its own, after the seven attributes the radar shows.
    row('Sensory', TASTE_LABELS.overall, (b) => score(b.overall)),
    row('Sensory', 'Flavours', (b) => (b.flavours.length ? b.flavours.join(', ') : DASH)),
  ];
}

/** The seven attribute scores in radar order. */
export const attributeScores = (b: CompareBrew): (number | null)[] => ATTRIBUTE_KEYS.map((k) => b[k]);

/** `?ids=a,b,c` as up to three distinct valid ids, in order. */
export function parseCompareIds(value: string | string[] | null | undefined): string[] {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return [];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids: string[] = [];
  for (const part of text.split(',')) {
    const id = part.trim().toLowerCase();
    if (uuid.test(id) && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, 3);
}

export const comparePathFor = (ids: readonly string[]): string => `/brews/compare?ids=${ids.join(',')}`;
