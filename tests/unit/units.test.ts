import { describe, expect, it } from 'vitest';
import {
  cToF,
  defaultsForLocale,
  formatDate,
  formatDateTime,
  formatDuration,
  formatTemp,
  formatTime,
  formatWeight,
  fToC,
  gToOz,
  ozToG,
  parseDuration,
  parseNumber,
  previewLine,
  tempFromDisplay,
  tempToDisplay,
  weightFromDisplay,
  weightToDisplay,
  type UnitSettings,
} from '@/lib/units';

const metric: UnitSettings = {
  temp_unit: 'c',
  weight_unit: 'g',
  date_format: 'dmy',
  time_format: '24h',
  time_zone: 'UTC',
};
const imperial: UnitSettings = {
  temp_unit: 'f',
  weight_unit: 'oz',
  date_format: 'mdy',
  time_format: '12h',
  time_zone: 'UTC',
};

// 14 Nov 2026, 14:52 UTC.
const INSTANT = new Date('2026-11-14T14:52:00Z');

describe('conversion', () => {
  it('converts the reference points', () => {
    expect(cToF(100)).toBe(212);
    expect(cToF(0)).toBe(32);
    expect(fToC(212)).toBe(100);
    expect(gToOz(28.349523125)).toBeCloseTo(1, 10);
    expect(ozToG(1)).toBeCloseTo(28.3495, 4);
  });

  it('displays stored metric values in the chosen unit', () => {
    expect(tempToDisplay(93, 'c')).toBe(93);
    expect(tempToDisplay(93, 'f')).toBe(199.4);
    expect(weightToDisplay(18, 'g')).toBe(18);
    expect(weightToDisplay(18, 'oz')).toBe(0.63);
  });

  it('round-trips what a person types without drifting', () => {
    for (const f of [150, 185, 195, 199, 200, 205, 212]) {
      const stored = tempFromDisplay(f, 'f');
      // Showing the stored value again gives back what was typed (to the displayed precision).
      expect(Math.abs(tempToDisplay(stored, 'f') - f)).toBeLessThanOrEqual(0.1);
    }
    for (const oz of [0.5, 0.63, 1, 2.5, 16]) {
      const stored = weightFromDisplay(oz, 'oz');
      expect(weightToDisplay(stored, 'oz')).toBe(oz);
    }
  });

  it('does not change metric values when the unit is metric', () => {
    expect(tempFromDisplay(93.5, 'c')).toBe(93.5);
    expect(weightFromDisplay(18.25, 'g')).toBe(18.25);
  });

  it('handles edge values', () => {
    expect(tempToDisplay(0, 'f')).toBe(32);
    expect(tempToDisplay(-40, 'f')).toBe(-40);
    expect(weightToDisplay(0, 'oz')).toBe(0);
    expect(weightToDisplay(0.1, 'oz')).toBe(0);
  });
});

describe('formatting', () => {
  it('formats temperatures and weights with the unit', () => {
    expect(formatTemp(93, 'c')).toBe('93 °C');
    expect(formatTemp(93, 'f')).toBe('199.4 °F');
    expect(formatTemp(93.04, 'c')).toBe('93 °C');
    expect(formatWeight(18, 'g')).toBe('18 g');
    expect(formatWeight(18, 'oz')).toBe('0.63 oz');
    expect(formatWeight(250.5, 'g')).toBe('250.5 g');
  });

  it('formats durations as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(30)).toBe('0:30');
    expect(formatDuration(125)).toBe('2:05');
    expect(formatDuration(4500)).toBe('75:00');
    expect(formatDuration(-5)).toBe('0:00');
  });

  it('parses durations and numbers', () => {
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('45')).toBe(45);
    expect(parseDuration('1:75')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(parseNumber('93')).toBe(93);
    expect(parseNumber('93,5')).toBe(93.5);
    expect(parseNumber('200 °F')).toBe(200);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('1e5')).toBeNull();
  });

  it('formats dates in every order', () => {
    expect(formatDate(INSTANT, 'dmy', 'UTC')).toBe('14 Nov 2026');
    expect(formatDate(INSTANT, 'mdy', 'UTC')).toBe('Nov 14, 2026');
    expect(formatDate(INSTANT, 'ymd', 'UTC')).toBe('2026-11-14');
  });

  it('formats times in 24h and 12h, including midnight and noon', () => {
    expect(formatTime(INSTANT, '24h', 'UTC')).toBe('14:52');
    expect(formatTime(INSTANT, '12h', 'UTC')).toBe('2:52 PM');
    expect(formatTime(new Date('2026-11-14T00:05:00Z'), '12h', 'UTC')).toBe('12:05 AM');
    expect(formatTime(new Date('2026-11-14T12:00:00Z'), '12h', 'UTC')).toBe('12:00 PM');
    expect(formatTime(new Date('2026-11-14T00:05:00Z'), '24h', 'UTC')).toBe('00:05');
  });

  it("uses the person's time zone, including when it changes the date", () => {
    expect(formatTime(INSTANT, '24h', 'America/New_York')).toBe('09:52');
    const late = new Date('2026-11-14T23:30:00Z');
    expect(formatDate(late, 'dmy', 'Asia/Tokyo')).toBe('15 Nov 2026');
  });

  it('falls back to UTC for an unknown time zone', () => {
    expect(formatTime(INSTANT, '24h', 'Not/AZone')).toBe('14:52');
  });

  it('builds the preview line', () => {
    expect(previewLine(metric, INSTANT)).toBe('93 °C · 18 g · 14 Nov 2026, 14:52');
    expect(previewLine(imperial, INSTANT)).toBe('199.4 °F · 0.63 oz · Nov 14, 2026, 2:52 PM');
    expect(formatDateTime(INSTANT, { ...metric, date_format: 'ymd' })).toBe('2026-11-14, 14:52');
  });
});

describe('locale defaults', () => {
  it('uses imperial units in the US, Liberia and Myanmar', () => {
    for (const locale of ['en-US', 'en-LR', 'my-MM']) {
      expect(defaultsForLocale(locale, 'UTC')).toMatchObject({
        temp_unit: 'f',
        weight_unit: 'oz',
        date_format: 'mdy',
        time_format: '12h',
      });
    }
  });

  it('uses metric elsewhere, with the clock from the locale', () => {
    expect(defaultsForLocale('en-GB', 'Europe/London', false)).toMatchObject({
      temp_unit: 'c',
      weight_unit: 'g',
      date_format: 'dmy',
      time_format: '24h',
      time_zone: 'Europe/London',
    });
    expect(defaultsForLocale('en-AU', 'Australia/Sydney', true).time_format).toBe('12h');
    expect(defaultsForLocale('de-DE', 'Europe/Berlin').time_format).toBe('24h');
  });

  it('survives a locale it cannot read', () => {
    expect(defaultsForLocale('not a locale', 'UTC', false).temp_unit).toBe('c');
  });
});
