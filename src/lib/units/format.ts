import { TEMP_DECIMALS, WEIGHT_DECIMALS, tempToDisplay, weightToDisplay } from './convert';
import type { DateFormat, TempUnit, TimeFormat, UnitSettings, WeightUnit } from './types';

const number = (decimals: number) =>
  new Intl.NumberFormat('en', { maximumFractionDigits: decimals, useGrouping: false });

const TEMP_FMT = number(TEMP_DECIMALS);
const WEIGHT_FMT: Record<WeightUnit, Intl.NumberFormat> = {
  g: number(WEIGHT_DECIMALS.g),
  oz: number(WEIGHT_DECIMALS.oz),
};

export const TEMP_LABEL: Record<TempUnit, '°C' | '°F'> = { c: '°C', f: '°F' };
export const WEIGHT_LABEL: Record<WeightUnit, 'g' | 'oz'> = { g: 'g', oz: 'oz' };

/** "93 °C" / "199.4 °F" from a stored °C value. */
export function formatTemp(celsius: number, unit: TempUnit): string {
  return `${TEMP_FMT.format(tempToDisplay(celsius, unit))} ${TEMP_LABEL[unit]}`;
}

/** "18 g" / "0.63 oz" from a stored gram value. */
export function formatWeight(grams: number, unit: WeightUnit): string {
  return `${WEIGHT_FMT[unit].format(weightToDisplay(grams, unit))} ${WEIGHT_LABEL[unit]}`;
}

/** m:ss from stored seconds ("2:05", "0:30"); hours roll into minutes ("75:00"). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** m:ss or plain seconds typed by a person, as seconds, or null. "1:30" is 90, "45" is 45. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(\d+):([0-5]?\d)$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** A valid IANA zone, or UTC when the stored one isn't known to this runtime. */
export function safeTimeZone(zone: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return zone;
  } catch {
    return 'UTC';
  }
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number };

function parts(date: Date, timeZone: string): Parts {
  const out: Record<string, number> = {};
  for (const p of new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as Parts;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** dmy "14 Nov 2026" · mdy "Nov 14, 2026" · ymd "2026-11-14", in the user's time zone. */
export function formatDate(
  value: Date | string | number,
  format: DateFormat,
  timeZone: string,
): string {
  const p = parts(toDate(value), timeZone);
  const month = MONTHS[p.month - 1] ?? '';
  if (format === 'mdy') return `${month} ${p.day}, ${p.year}`;
  if (format === 'ymd') {
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  }
  return `${p.day} ${month} ${p.year}`;
}

/** 24h "14:52" · 12h "2:52 PM", in the user's time zone. */
export function formatTime(
  value: Date | string | number,
  format: TimeFormat,
  timeZone: string,
): string {
  const p = parts(toDate(value), timeZone);
  const minute = String(p.minute).padStart(2, '0');
  if (format === '24h') return `${String(p.hour).padStart(2, '0')}:${minute}`;
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${h12}:${minute} ${p.hour < 12 ? 'AM' : 'PM'}`;
}

export function formatDateTime(value: Date | string | number, s: UnitSettings): string {
  const date = formatDate(value, s.date_format, s.time_zone);
  return `${date}, ${formatTime(value, s.time_format, s.time_zone)}`;
}

/** The one-line sample on the units screen: "93 °C · 18 g · 14 Nov 2026, 14:52". */
export function previewLine(s: UnitSettings, now: Date = new Date()): string {
  return [
    formatTemp(93, s.temp_unit),
    formatWeight(18, s.weight_unit),
    formatDateTime(now, s),
  ].join(' · ');
}
