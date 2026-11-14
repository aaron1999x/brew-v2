import type { UnitSettings } from './types';

/** Regions that use °F, oz, month-first dates and a 12-hour clock. */
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

/** The region of a locale tag: "en-US" is "US". A bare "en" is guessed ("US") by Intl. */
export function regionOf(locale: string): string | null {
  try {
    const l = new Intl.Locale(locale);
    return l.region ?? l.maximize().region ?? null;
  } catch {
    return null;
  }
}

function usesTwelveHour(locale: string): boolean {
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 === true;
  } catch {
    return false;
  }
}

/**
 * Starting values for onboarding, from the device. US, Liberia and Myanmar get °F, oz, mdy and
 * 12h. Everywhere else gets °C, g and dmy, with 12h or 24h from the locale's hour cycle.
 */
export function defaultsForLocale(
  locale: string,
  timeZone: string,
  twelveHour?: boolean,
): UnitSettings {
  const region = regionOf(locale);
  if (region && IMPERIAL_REGIONS.has(region)) {
    return {
      temp_unit: 'f',
      weight_unit: 'oz',
      date_format: 'mdy',
      time_format: '12h',
      time_zone: timeZone,
    };
  }
  return {
    temp_unit: 'c',
    weight_unit: 'g',
    date_format: 'dmy',
    time_format: (twelveHour ?? usesTwelveHour(locale)) ? '12h' : '24h',
    time_zone: timeZone,
  };
}

/** Defaults for the browser the code runs in. Falls back to metric and UTC without Intl. */
export function deviceDefaults(): UnitSettings {
  try {
    const opts = new Intl.DateTimeFormat().resolvedOptions();
    return defaultsForLocale(opts.locale, opts.timeZone || 'UTC');
  } catch {
    return defaultsForLocale('en-GB', 'UTC', false);
  }
}

/** Every IANA zone the browser knows (for the searchable time-zone list). */
export function listTimeZones(): string[] {
  try {
    const zones = Intl.supportedValuesOf('timeZone');
    return zones.includes('UTC') ? zones : ['UTC', ...zones];
  } catch {
    return ['UTC'];
  }
}
