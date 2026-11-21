import { parseTypedNumber } from '@/lib/ui/typedNumber';
import {
  TASTE_KEYS,
  emptyBrewLogForm,
  validateBrewLog,
  type BrewIssue,
  type BrewLogDraft,
  type BrewLogForm,
  type TasteKey,
} from './schema';

/** The text of a number field that isn't a number, kept as typed so saving can say what is wrong. */
export type TypedText = Partial<Record<'tdsPct' | 'tastedAfterMin', string>>;

export const BREW_FIELD_PREFIX = 'brew-field-';
/** The id of a form field's input, so the error summary can focus it. */
export const brewFieldId = (key: keyof BrewLogForm | 'form'): string => `${BREW_FIELD_PREFIX}${key}`;

export const TYPED_MESSAGES = {
  tdsPct: 'Use a number, e.g. 1.38',
  tastedAfterMin: 'Use whole minutes, e.g. 10',
} as const;

// ---- date and time --------------------------------------------------------------------------

const pad = (n: number): string => String(n).padStart(2, '0');

/** An ISO time as the `YYYY-MM-DDTHH:mm` text a date-time input uses, in this device's time zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The reverse: a date-time input's text as an ISO time, or '' when it isn't a whole date and time. */
export function fromLocalInput(text: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return '';
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

// ---- the form -------------------------------------------------------------------------------

/**
 * A form from a saved draft (any field may be missing), a drawdown from the timer and a default
 * brew time. A draft value wins over the timer, which wins over the default.
 */
export function formFromDraft(
  draft: BrewLogDraft | null | undefined,
  defaults: { brewedAt: string; drawdownS?: number | null },
): BrewLogForm {
  const base = emptyBrewLogForm(defaults.brewedAt);
  if (defaults.drawdownS != null) base.drawdownS = defaults.drawdownS;
  if (!draft) return base;
  const merged = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(draft)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged as BrewLogForm;
}

/** The form as a draft to keep on the device (the same shape, nothing validated). */
export function draftFromForm(form: BrewLogForm): BrewLogDraft {
  return { ...form };
}

/** The scores in the radar's order. Null = not scored. */
export function tasteValues(form: Pick<BrewLogForm, TasteKey>): (number | null)[] {
  return TASTE_KEYS.map((key) => form[key]);
}

export function hasAnyScore(form: Pick<BrewLogForm, TasteKey>): boolean {
  return tasteValues(form).some((v) => v != null);
}

/**
 * Checks the form for saving. Text typed into a number field that isn't a number is reported first,
 * with the field's own wording; everything else comes from the shared schema. Issues are in form order.
 */
export function checkBrewForm(
  form: BrewLogForm,
  typed: TypedText,
  now: number = Date.now(),
): { ok: true; data: BrewLogForm } | { ok: false; issues: BrewIssue[] } {
  const result = validateBrewLog(form, now);
  const issues: BrewIssue[] = result.ok ? [] : [...result.issues];
  for (const key of ['tdsPct', 'tastedAfterMin'] as const) {
    const text = typed[key];
    if (text !== undefined && parseTypedNumber(text).kind === 'invalid') {
      const at = issues.findIndex((i) => i.field === key);
      if (at >= 0) issues.splice(at, 1);
      issues.push({ field: key, message: TYPED_MESSAGES[key] });
    }
  }
  // A readable number that isn't allowed gets the same wording as unreadable text.
  for (const issue of issues) {
    if (issue.field === 'tastedAfterMin' && issue.message === 'Minutes are a whole number') {
      issue.message = TYPED_MESSAGES.tastedAfterMin;
    }
  }
  if (issues.length === 0 && result.ok) return result;
  const order = Object.keys(emptyBrewLogForm('')) as string[];
  issues.sort((a, b) => order.indexOf(a.field) - order.indexOf(b.field));
  return { ok: false, issues };
}

/** True when two forms hold the same values (used to tell whether an edit changed anything). */
export function sameForm(a: BrewLogForm, b: BrewLogForm): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The form for editing a saved brew, from its row. */
export function formFromBrewRow(row: {
  brewed_at: string;
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
  tasted_temp: BrewLogForm['tastedTemp'];
  tasted_after_min: number | null;
  notes: string | null;
  next_change: string | null;
}): BrewLogForm {
  return {
    brewedAt: row.brewed_at,
    drawdownS: row.drawdown_s,
    beverageG: row.beverage_g,
    tdsPct: row.tds_pct,
    sweetness: row.sweetness,
    acidity: row.acidity,
    brightness: row.brightness,
    body: row.body,
    clarity: row.clarity,
    balance: row.balance,
    aftertaste: row.aftertaste,
    overall: row.overall,
    flavours: row.flavours,
    tastedTemp: row.tasted_temp,
    tastedAfterMin: row.tasted_after_min,
    notes: row.notes ?? '',
    nextChange: row.next_change ?? '',
  };
}

/** "Tasted warm, 10 min after brewing", or null when neither was recorded. */
export function tastedAtText(temp: BrewLogForm['tastedTemp'], minutes: number | null): string | null {
  const parts: string[] = [];
  if (temp) parts.push(`Tasted ${temp}`);
  if (minutes != null) parts.push(`${temp ? '' : 'Tasted '}${minutes} min after brewing`);
  return parts.length ? parts.join(', ') : null;
}
