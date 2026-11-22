/**
 * What a person typed into a number field, read without ever refusing a keystroke. The field keeps
 * their text exactly as typed; this only says whether it is empty, a number, or not a number, so the
 * form can show a message when they save (instead of the field silently ignoring a key).
 *
 * A decimal comma is accepted ("7,5" is 7.5). Spaces, letters, a second decimal point and
 * exponents ("1e3") are not numbers here.
 */
export type TypedNumber =
  | { kind: 'empty' }
  | { kind: 'number'; value: number }
  | { kind: 'invalid' };

export function parseTypedNumber(text: string): TypedNumber {
  const t = text.trim();
  if (t === '') return { kind: 'empty' };
  // One optional sign, digits, at most one decimal separator (a dot or a comma), and a digit somewhere.
  if (!/^[+-]?(\d+[.,]?\d*|[.,]\d+)$/.test(t)) return { kind: 'invalid' };
  const value = Number(t.replace(',', '.'));
  return Number.isFinite(value) ? { kind: 'number', value } : { kind: 'invalid' };
}

/** The text a field starts with for a stored number: "750", "7.5", or nothing. */
export function numberToText(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '' : String(value);
}
