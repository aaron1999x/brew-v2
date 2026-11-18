import { describe, expect, it } from 'vitest';
import {
  MAX_FAVOURITE_GEAR,
  buildFavouriteGear,
  favouriteFromItem,
  gearCategoryLabel,
  isLinkedFavourite,
  parseFavouriteGear,
} from '@/lib/profile/gear';
import type { GearItem } from '@/lib/recipes/gear';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

const item = (id: string, over: Partial<GearItem> = {}): GearItem => ({
  id,
  category: 'grinder',
  catalog_id: null,
  custom_name: 'Hand grinder',
  nickname: 'Old faithful',
  notes: null,
  is_default: false,
  catalog: null,
  ...over,
});

describe('parseFavouriteGear', () => {
  it('reads linked entries and legacy free-text entries, and drops the rest', () => {
    const parsed = parseFavouriteGear([
      { item_id: A, category: 'grinder', name: 'Comandante C40 MK4' },
      { category: 'kettle', name: 'Old kettle' },
      { category: 'nope', name: 'x' },
      { category: 'kettle', name: '' },
      { item_id: 'not-a-uuid', category: 'grinder', name: 'Falls back to legacy' },
      'text',
      null,
    ]);
    expect(parsed).toEqual([
      { item_id: A, category: 'grinder', name: 'Comandante C40 MK4' },
      { category: 'kettle', name: 'Old kettle' },
      { category: 'grinder', name: 'Falls back to legacy' },
    ]);
    expect(isLinkedFavourite(parsed[0]!)).toBe(true);
    expect(isLinkedFavourite(parsed[1]!)).toBe(false);
  });

  it('is empty for anything that is not a list', () => {
    expect(parseFavouriteGear(null)).toEqual([]);
    expect(parseFavouriteGear({})).toEqual([]);
    expect(parseFavouriteGear('x')).toEqual([]);
  });

  it('keeps at most five', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ category: 'other', name: `item ${i}` }));
    expect(parseFavouriteGear(six)).toHaveLength(MAX_FAVOURITE_GEAR);
  });
});

describe('buildFavouriteGear', () => {
  const items = [
    item(A),
    item(B, {
      category: 'brewer',
      custom_name: null,
      catalog: { id: 'c1', name: 'Hario V60 02' },
      catalog_id: 'c1',
      nickname: null,
    }),
  ];

  it('saves the real name of each chosen item, never its nickname, in the order chosen', () => {
    expect(buildFavouriteGear([B, A], items, [])).toEqual([
      { item_id: B, category: 'brewer', name: 'Hario V60 02' },
      { item_id: A, category: 'grinder', name: 'Hand grinder' },
    ]);
    expect(favouriteFromItem(items[0]!)).toEqual({
      item_id: A,
      category: 'grinder',
      name: 'Hand grinder',
    });
  });

  it('puts legacy entries after the chosen items', () => {
    expect(buildFavouriteGear([A], items, [{ category: 'kettle', name: 'Old kettle' }])).toEqual([
      { item_id: A, category: 'grinder', name: 'Hand grinder' },
      { category: 'kettle', name: 'Old kettle' },
    ]);
  });

  it('drops chosen ids that are no longer my gear', () => {
    expect(buildFavouriteGear([C, A], items, [])).toEqual([
      { item_id: A, category: 'grinder', name: 'Hand grinder' },
    ]);
  });

  it('never stores more than five', () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      item(`00000000-0000-4000-8000-00000000000${i}`),
    );
    expect(
      buildFavouriteGear(
        many.map((m) => m.id),
        many,
        [],
      ),
    ).toHaveLength(MAX_FAVOURITE_GEAR);
  });
});

describe('category labels', () => {
  it('names categories and falls back to Other', () => {
    expect(gearCategoryLabel('grinder')).toBe('Grinder');
    expect(gearCategoryLabel('unknown')).toBe('Other');
  });
});
