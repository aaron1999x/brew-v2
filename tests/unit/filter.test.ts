import { describe, expect, it } from 'vitest';
import { filterItems, hasExactMatch, normalizeText } from '@/lib/ui/filter';

const gear = [
  'Comandante C40 MK4',
  'Timemore Chestnut C3',
  'Fellow Ode Gen 2',
  'Café du Monde press',
  'Hario V60',
];
const label = (s: string) => s;

describe('normalizeText', () => {
  it('lower-cases and strips accents', () => {
    expect(normalizeText('  Café ')).toBe('cafe');
  });
});

describe('filterItems', () => {
  it('returns everything for an empty query', () => {
    expect(filterItems(gear, '  ', label)).toEqual(gear);
  });
  it('matches ignoring case and accents', () => {
    expect(filterItems(gear, 'CAFE', label)).toEqual(['Café du Monde press']);
  });
  it('requires every word, in any order', () => {
    expect(filterItems(gear, 'c40 coman', label)).toEqual(['Comandante C40 MK4']);
    expect(filterItems(gear, 'chestnut zzz', label)).toEqual([]);
  });
  it('ranks prefix matches first, then word-start matches, then the rest, keeping order within a rank', () => {
    const items = ['Grinder Hario', 'Hario V60', 'Mini Hariomatic', 'Hario Switch'];
    expect(filterItems(items, 'hario', label)).toEqual([
      'Hario V60',
      'Hario Switch',
      'Grinder Hario',
      'Mini Hariomatic',
    ]);
  });
  it('does not mutate the input', () => {
    const copy = [...gear];
    filterItems(gear, 'c', label);
    expect(gear).toEqual(copy);
  });
});

describe('hasExactMatch', () => {
  it('detects an exact label ignoring case and accents', () => {
    expect(hasExactMatch(gear, 'hario v60', label)).toBe(true);
    expect(hasExactMatch(gear, 'cafe du monde press', label)).toBe(true);
    expect(hasExactMatch(gear, 'hario', label)).toBe(false);
  });
});
