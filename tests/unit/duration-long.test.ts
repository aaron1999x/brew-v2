import { describe, expect, it } from 'vitest';
import {
  RATE_DECIMALS,
  RATE_LABEL,
  DURATION_MAX_S,
  formatClock,
  formatDuration as formatMinutes,
  formatRate,
  parseDuration as parseSimple,
  rateFromDisplay,
  rateToDisplay,
} from '@/lib/units';
import { DURATION_ERROR, formatDuration, parseDuration } from '@/lib/ui/duration';

describe('formatClock (m:ss, then h:mm:ss from one hour)', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [70, '1:10'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3661, '1:01:01'],
    [43_200, '12:00:00'],
    [86_399, '23:59:59'],
    [DURATION_MAX_S, '48:00:00'],
  ])('%i s reads %s', (seconds, text) => {
    expect(formatClock(seconds)).toBe(text);
  });

  it('clamps negatives and rounds fractions', () => {
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock(59.6)).toBe('1:00');
  });

  it('leaves the older minutes-only format alone', () => {
    expect(formatMinutes(4500)).toBe('75:00');
    expect(formatMinutes(3600)).toBe('60:00');
  });
});

describe('parsing h:mm:ss', () => {
  it.each([
    ['1:00:00', 3600],
    ['12:00:00', 43_200],
    ['0:05:30', 330],
    ['48:00:00', 172_800],
    ['1:02:03', 3723],
    [' 12:00:00 ', 43_200],
  ])('reads %s as %i seconds', (input, seconds) => {
    expect(parseDuration(input)).toEqual({ ok: true, seconds });
    expect(parseSimple(input)).toBe(seconds);
  });

  it.each(['1:60:00', '1:00:60', '1:2:03', '1:02:3', '1:00:00:00', '12::00', ':00:00'])(
    'rejects %s',
    (input) => {
      expect(parseDuration(input)).toEqual({ ok: false, error: DURATION_ERROR });
      expect(parseSimple(input)).toBeNull();
    },
  );

  it('keeps every older input working', () => {
    expect(parseDuration('2:30')).toEqual({ ok: true, seconds: 150 });
    expect(parseDuration('230')).toEqual({ ok: true, seconds: 150 });
    expect(parseDuration('150s')).toEqual({ ok: true, seconds: 150 });
    expect(parseDuration('90:00')).toEqual({ ok: true, seconds: 5400 });
    expect(parseSimple('90:00')).toBe(5400);
  });

  it('round-trips format and parse across the whole range', () => {
    for (const s of [0, 1, 59, 60, 3599, 3600, 3601, 43_200, 86_400, 100_000, DURATION_MAX_S]) {
      expect(parseDuration(formatDuration(s))).toEqual({ ok: true, seconds: s });
      expect(parseSimple(formatClock(s))).toBe(s);
    }
  });
});

describe('pour rate', () => {
  it('shows g/s as stored and oz/s with 3 decimals', () => {
    expect(rateToDisplay(3.5, 'g')).toBe(3.5);
    expect(rateToDisplay(3.5, 'oz')).toBe(0.123);
    expect(rateToDisplay(0.01, 'oz')).toBe(0);
    expect(RATE_DECIMALS).toEqual({ g: 1, oz: 3 });
  });

  it('stores what was typed, to 0.01 g/s', () => {
    expect(rateFromDisplay(3.5, 'g')).toBe(3.5);
    expect(rateFromDisplay(0.123, 'oz')).toBe(3.49);
    expect(rateFromDisplay(0.1, 'oz')).toBe(2.83);
  });

  it('formats with its unit label', () => {
    expect(RATE_LABEL).toEqual({ g: 'g/s', oz: 'oz/s' });
    expect(formatRate(3.5, 'g')).toBe('3.5 g/s');
    expect(formatRate(3.5, 'oz')).toBe('0.123 oz/s');
    expect(formatRate(4, 'g')).toBe('4 g/s');
  });
});
