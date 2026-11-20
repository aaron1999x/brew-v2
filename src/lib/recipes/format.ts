/**
 * A roast date (`YYYY-MM-DD`) as text in the device's language, e.g. "19 Nov 2026". It is a
 * calendar date, not a moment: it is read and shown in UTC, so no time zone can move it a day.
 */
export function formatRoastDate(value: string, locale?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

/** "1:00 to 1:30", or one value when only one end is set, or null when neither is. */
export function formatRange(
  min: number | null,
  max: number | null,
  format: (n: number) => string,
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return min === max ? format(min) : `${format(min)} to ${format(max)}`;
  return format((min ?? max) as number);
}
