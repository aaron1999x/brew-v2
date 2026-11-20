import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIST_PARAMS,
  filterRecipes,
  hasFilters,
  listHref,
  parseListParams,
  sortRecipes,
  type ListParams,
  type RecipeListItem,
} from '@/lib/recipes/list';

const item = (over: Partial<RecipeListItem>): RecipeListItem => ({
  id: 'r',
  slug: 'r',
  name: 'Recipe',
  method: 'pour_over',
  method_custom: null,
  visibility: 'private',
  archived_at: null,
  edited_at: '2026-11-10T10:00:00Z',
  last_brewed_at: null,
  latest_version_no: 1,
  dose_g: 15,
  brew_water_g: 250,
  bypass_g: 0,
  coffee_name: null,
  roaster: null,
  origin: null,
  ...over,
});

const params = (over: Partial<ListParams> = {}): ListParams => ({ ...DEFAULT_LIST_PARAMS, ...over });
const reader = (query: string) => new URLSearchParams(query);

describe('parseListParams and listHref', () => {
  it('reads the defaults from an empty URL', () => {
    expect(parseListParams(reader(''))).toEqual(DEFAULT_LIST_PARAMS);
  });

  it('reads every choice', () => {
    expect(
      parseListParams(reader('q=v60&method=aeropress&visibility=private&sort=name&tab=archived')),
    ).toEqual({ q: 'v60', method: 'aeropress', visibility: 'private', sort: 'name', tab: 'archived' });
  });

  it('falls back to the default for anything unknown, so a bad link still works', () => {
    expect(
      parseListParams(reader('method=tea&visibility=secret&sort=random&tab=trash')),
    ).toEqual(DEFAULT_LIST_PARAMS);
  });

  it('keeps the search short', () => {
    expect(parseListParams(reader(`q=${'a'.repeat(300)}`)).q).toHaveLength(100);
  });

  it('writes only what differs from the defaults, and reads back what it wrote', () => {
    expect(listHref(DEFAULT_LIST_PARAMS)).toBe('/recipes');
    const chosen = params({ q: ' v60 ', method: 'pour_over', sort: 'edited', tab: 'archived' });
    const href = listHref(chosen);
    expect(href).toBe('/recipes?q=v60&method=pour_over&sort=edited&tab=archived');
    expect(parseListParams(new URL(href, 'https://x.test').searchParams)).toEqual({
      ...chosen,
      q: 'v60',
    });
  });
});

describe('hasFilters', () => {
  it('counts a search, a method or a visibility, but not the sort or the tab', () => {
    expect(hasFilters(params())).toBe(false);
    expect(hasFilters(params({ sort: 'name', tab: 'archived' }))).toBe(false);
    expect(hasFilters(params({ q: '  ' }))).toBe(false);
    expect(hasFilters(params({ q: 'x' }))).toBe(true);
    expect(hasFilters(params({ method: 'aeropress' }))).toBe(true);
    expect(hasFilters(params({ visibility: 'private' }))).toBe(true);
  });
});

describe('filterRecipes', () => {
  const items = [
    item({ id: '1', name: 'Morning V60', coffee_name: 'Ethiopia Guji', roaster: 'Common Man', origin: 'Ethiopia' }),
    item({ id: '2', name: 'Evening AeroPress', method: 'aeropress', roaster: 'Tiong Hoe' }),
    item({ id: '3', name: 'Old Kalita', archived_at: '2026-11-01T00:00:00Z' }),
    item({ id: '4', name: 'Café au lait', method: 'french_press', origin: 'Brazil' }),
  ];
  const ids = (list: RecipeListItem[]) => list.map((i) => i.id);

  it('splits the Recipes and Archived tabs', () => {
    expect(ids(filterRecipes(items, params()))).toEqual(['1', '2', '4']);
    expect(ids(filterRecipes(items, params({ tab: 'archived' })))).toEqual(['3']);
  });

  it('searches name, coffee, roaster and origin; every word must match, in any order', () => {
    expect(ids(filterRecipes(items, params({ q: 'v60' })))).toEqual(['1']);
    expect(ids(filterRecipes(items, params({ q: 'guji morning' })))).toEqual(['1']);
    expect(ids(filterRecipes(items, params({ q: 'tiong' })))).toEqual(['2']);
    expect(ids(filterRecipes(items, params({ q: 'ethiopia' })))).toEqual(['1']);
    expect(ids(filterRecipes(items, params({ q: 'guji aeropress' })))).toEqual([]);
  });

  it('ignores case and accents', () => {
    expect(ids(filterRecipes(items, params({ q: 'CAFE' })))).toEqual(['4']);
  });

  it('filters by method and by visibility', () => {
    expect(ids(filterRecipes(items, params({ method: 'aeropress' })))).toEqual(['2']);
    expect(ids(filterRecipes(items, params({ visibility: 'private' })))).toEqual(['1', '2', '4']);
    expect(ids(filterRecipes(items, params({ visibility: 'public' })))).toEqual([]);
  });

  it('combines the search with the filters', () => {
    expect(ids(filterRecipes(items, params({ q: 'e', method: 'aeropress' })))).toEqual(['2']);
  });
});

describe('sortRecipes', () => {
  const items = [
    item({ id: 'a', name: 'banana', edited_at: '2026-11-03T00:00:00Z' }),
    item({ id: 'b', name: 'Apple', edited_at: '2026-11-01T00:00:00Z', last_brewed_at: '2026-11-09T00:00:00Z' }),
    item({ id: 'c', name: 'cherry', edited_at: '2026-11-05T00:00:00Z' }),
  ];
  const ids = (list: RecipeListItem[]) => list.map((i) => i.id);

  it('sorts by last edited, newest first', () => {
    expect(ids(sortRecipes(items, 'edited'))).toEqual(['c', 'a', 'b']);
  });

  it('sorts by name, ignoring case', () => {
    expect(ids(sortRecipes(items, 'name'))).toEqual(['b', 'a', 'c']);
  });

  it('sorts by last brewed, and a recipe never brewed counts from when it was last edited', () => {
    expect(ids(sortRecipes(items, 'brewed'))).toEqual(['b', 'c', 'a']);
  });

  it('keeps a steady order for ties and does not change the list it was given', () => {
    const same = [item({ id: 'x', name: 'Same' }), item({ id: 'y', name: 'Same' })];
    expect(ids(sortRecipes(same, 'name'))).toEqual(ids(sortRecipes([...same].reverse(), 'name')).reverse());
    const before = ids(items);
    sortRecipes(items, 'name');
    expect(ids(items)).toEqual(before);
  });
});
