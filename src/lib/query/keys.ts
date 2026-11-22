/** One factory for every TanStack Query key (docs/phase-4-amendments.md §2). */
export type RecipeFilters = {
  search?: string;
  method?: string;
  visibility?: string;
  archived?: boolean;
};
export type BrewFilters = { recipeId?: string; versionId?: string; search?: string };

export const queryKeys = {
  recipes: {
    mine: (filters: RecipeFilters = {}) => ['recipes', 'mine', filters] as const,
    /** Every recipes list, for invalidating them together. */
    all: () => ['recipes'] as const,
  },
  /** Every open recipe page and version list, for invalidating or patching them together. */
  recipePages: () => ['recipe'] as const,
  recipe: (handle: string, slug: string) => ['recipe', handle, slug] as const,
  recipeVersion: (id: string) => ['recipe-version', id] as const,
  brews: {
    mine: (filters: BrewFilters = {}) => ['brews', 'mine', filters] as const,
    recent: (limit: number) => ['brews', 'recent', limit] as const,
    compare: (ids: readonly string[]) => ['brews', 'compare', ...ids] as const,
  },
  brew: (id: string) => ['brew', id] as const,
  /** My recent custom flavour tags (worked out from my latest brews). */
  flavourTags: () => ['flavour-tags', 'recent'] as const,
  /** Brew counts and last-brewed dates per recipe version (`my_recipe_brew_stats`). */
  brewStats: () => ['brew-stats'] as const,
  profile: (handle: string) => ['profile', handle] as const,
  verified: (method?: string) => ['verified', method ?? 'all'] as const,
  notices: () => ['notices'] as const,
  gear: () => ['gear'] as const,
  gearCatalog: () => ['gear-catalog'] as const,
  settings: () => ['settings'] as const,
  profileMe: () => ['profile', 'me'] as const,
  handleStatus: (handle: string) => ['handle-status', handle] as const,
  handleSuggestions: (base: string) => ['handle-suggestions', base] as const,
  invites: () => ['admin', 'invites'] as const,
};
