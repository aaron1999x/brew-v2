import { formatClock } from '@/lib/units/format';

export type DurationParse = { ok: true; seconds: number | null } | { ok: false; error: string };

export const DURATION_ERROR = 'Enter a time like 2:30, 230 or 150s';

/**
 * Parses what a brewer types into a number of seconds.
 *  - `2:30`            → 150 (m:ss; seconds must be two digits, below 60)
 *  - `12:00:00`        → 43200 (h:mm:ss; minutes and seconds two digits, below 60)
 *  - `45`, `90`        → seconds (1–2 digits)
 *  - `230`, `1005`     → m:ss, like a microwave (3–4 digits; last two are the seconds)
 *  - `150s`            → seconds (a trailing "s" forces seconds)
 *  - empty             → `null` (nothing entered yet)
 * The range (0 to 48 h) is the field's job, not the parser's.
 */
export function parseDuration(input: string): DurationParse {
  const text = input.trim().toLowerCase();
  if (text === '') return { ok: true, seconds: null };

  const secondsOnly = /^(\d+)\s*s$/.exec(text);
  if (secondsOnly) return { ok: true, seconds: Number(secondsOnly[1]) };

  const hms = /^(\d+):(\d{2}):(\d{2})$/.exec(text);
  if (hms) {
    const [, h, m, s] = hms;
    if (Number(m) >= 60 || Number(s) >= 60) return { ok: false, error: DURATION_ERROR };
    return { ok: true, seconds: Number(h) * 3600 + Number(m) * 60 + Number(s) };
  }

  const colon = /^(\d+):(\d{2})$/.exec(text);
  if (colon) return fromParts(Number(colon[1]), Number(colon[2]));

  if (/^\d{1,2}$/.test(text)) return { ok: true, seconds: Number(text) };

  if (/^\d{3,4}$/.test(text)) {
    return fromParts(Number(text.slice(0, -2)), Number(text.slice(-2)));
  }

  return { ok: false, error: DURATION_ERROR };
}

function fromParts(minutes: number, seconds: number): DurationParse {
  if (seconds >= 60) return { ok: false, error: DURATION_ERROR };
  return { ok: true, seconds: minutes * 60 + seconds };
}

/** 150 → "2:30", 45 → "0:45", 43200 → "12:00:00" (h:mm:ss from one hour). */
export function formatDuration(totalSeconds: number): string {
  return formatClock(totalSeconds);
}
