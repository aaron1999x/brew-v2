import { normalizeText } from '@/lib/ui/filter';
import { BREW_METHODS, type BrewMethod } from './methods';

/**
 * The My recipes list: what a row holds, and the search, filters and sort that run on the device
 * over the loaded list (a person has tens of recipes, not thousands). The choices live in the URL.
 */
export type RecipeListItem = {
  id: string;
  slug: string;
  name: string;
  method: BrewMethod;
  method_custom: string | null;
  visibility: 'private' | 'public' | 'hidden';
  archived_at: string | null;
  edited_at: string;
  last_brewed_at: string | null;
  latest_version_no: number;
  /** The latest version's numbers and coffee, for the row and for search. */
  dose_g: number | null;
  brew_water_g: number | null;
  bypass_g: number | null;
  coffee_name: string | null;
  roaster: string | null;
  origin: string | null;
};

export const LIST_SORTS = ['brewed', 'edited', 'name'] as const;
export type ListSort = (typeof LIST_SORTS)[number];
export const LIST_SORT_LABELS: Record<ListSort, string> = {
  brewed: 'Last brewed',
  edited: 'Last edited',
  name: 'Name A–Z',
};

export const LIST_VISIBILITIES = ['private', 'public', 'hidden'] as const;
export type ListVisibility = (typeof LIST_VISIBILITIES)[number];

export const LIST_TABS = ['recipes', 'archived'] as const;
export type ListTab = (typeof LIST_TABS)[number];

export type ListParams = {
  q: string;
  method: BrewMethod | null;
  visibility: ListVisibility | null;
  sort: ListSort;
  tab: ListTab;
};

export const DEFAULT_LIST_PARAMS: ListParams = {
  q: '',
  method: null,
  visibility: null,
  sort: 'brewed',
  tab: 'recipes',
};

type Reader = { get(name: string): string | null };

const pick = <T extends string>(allowed: readonly T[], value: string | null): T | null =>
  value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;

/** Reads the URL's choices; anything unknown falls back to the default, so a bad link still works. */
export function parseListParams(search: Reader): ListParams {
  return {
    q: (search.get('q') ?? '').slice(0, 100),
    method: pick(BREW_METHODS, search.get('method')),
    visibility: pick(LIST_VISIBILITIES, search.get('visibility')),
    sort: pick(LIST_SORTS, search.get('sort')) ?? DEFAULT_LIST_PARAMS.sort,
    tab: pick(LIST_TABS, search.get('tab')) ?? DEFAULT_LIST_PARAMS.tab,
  };
}

/** `/recipes?q=v60&sort=name`: only what differs from the defaults is written. */
export function listHref(params: ListParams): string {
  const query = new URLSearchParams();
  if (params.q.trim()) query.set('q', params.q.trim());
  if (params.method) query.set('method', params.method);
  if (params.visibility) query.set('visibility', params.visibility);
  if (params.sort !== DEFAULT_LIST_PARAMS.sort) query.set('sort', params.sort);
  if (params.tab !== DEFAULT_LIST_PARAMS.tab) query.set('tab', params.tab);
  const text = query.toString();
  return text ? `/recipes?${text}` : '/recipes';
}

/** Is anything narrowing the list (not counting which tab is showing)? */
export function hasFilters(params: ListParams): boolean {
  return Boolean(params.q.trim() || params.method || params.visibility);
}

/** The search, method and visibility filters, and the tab (archived or not). */
export function filterRecipes(
  items: readonly RecipeListItem[],
  params: ListParams,
): RecipeListItem[] {
  const words = normalizeText(params.q).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if ((item.archived_at !== null) !== (params.tab === 'archived')) return false;
    if (params.method && item.method !== params.method) return false;
    if (params.visibility && item.visibility !== params.visibility) return false;
    if (words.length === 0) return true;
    const haystack = normalizeText(
      [item.name, item.coffee_name, item.roaster, item.origin].filter(Boolean).join(' '),
    );
    return words.every((w) => haystack.includes(w));
  });
}

const time = (iso: string | null): number => (iso ? new Date(iso).getTime() : 0);

/**
 * Last brewed (falls back to last edited until brews are logged in M4), last edited, or name.
 * Ties keep a steady order: the most recently edited first, then by name.
 */
export function sortRecipes(items: readonly RecipeListItem[], sort: ListSort): RecipeListItem[] {
  const byName = (a: RecipeListItem, b: RecipeListItem) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const byEdited = (a: RecipeListItem, b: RecipeListItem) =>
    time(b.edited_at) - time(a.edited_at);
  const key = (r: RecipeListItem) => time(r.last_brewed_at ?? r.edited_at);
  return [...items].sort((a, b) => {
    if (sort === 'name') return byName(a, b) || byEdited(a, b);
    if (sort === 'edited') return byEdited(a, b) || byName(a, b);
    return key(b) - key(a) || byEdited(a, b) || byName(a, b);
  });
}
