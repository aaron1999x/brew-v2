import { describe, expect, it } from 'vitest';
import { DURATION_ERROR, formatDuration, parseDuration } from '@/lib/ui/duration';

describe('parseDuration', () => {
  it.each([
    ['45', 45],
    ['90', 90],
    ['230', 150],
    ['150', 110],
    ['1005', 605],
    ['150s', 150],
    ['2:30', 150],
    ['0:45', 45],
    ['10:05', 605],
    [' 2:30 ', 150],
    ['150S', 150],
  ])('reads %s as %i seconds', (input, seconds) => {
    expect(parseDuration(input)).toEqual({ ok: true, seconds });
  });

  it('treats empty input as nothing entered', () => {
    expect(parseDuration('')).toEqual({ ok: true, seconds: null });
    expect(parseDuration('   ')).toEqual({ ok: true, seconds: null });
  });

  it.each(['2:75', 'abc', '2:7', '190', '12345', '1:2:3', '-5', '2.5'])('rejects %s', (input) => {
    expect(parseDuration(input)).toEqual({ ok: false, error: DURATION_ERROR });
  });
});

describe('formatDuration', () => {
  it('formats as m:ss', () => {
    expect(formatDuration(150)).toBe('2:30');
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(605)).toBe('10:05');
    expect(formatDuration(0)).toBe('0:00');
  });
  it('round-trips through the parser', () => {
    for (const s of [0, 5, 59, 60, 61, 150, 599, 3599]) {
      expect(parseDuration(formatDuration(s))).toEqual({ ok: true, seconds: s });
    }
  });
});
