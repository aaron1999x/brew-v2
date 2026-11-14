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
  },
  recipe: (handle: string, slug: string) => ['recipe', handle, slug] as const,
  recipeVersion: (id: string) => ['recipe-version', id] as const,
  brews: {
    mine: (filters: BrewFilters = {}) => ['brews', 'mine', filters] as const,
  },
  brew: (id: string) => ['brew', id] as const,
  profile: (handle: string) => ['profile', handle] as const,
  verified: (method?: string) => ['verified', method ?? 'all'] as const,
  notices: () => ['notices'] as const,
  gear: () => ['gear'] as const,
  settings: () => ['settings'] as const,
  profileMe: () => ['profile', 'me'] as const,
  handleStatus: (handle: string) => ['handle-status', handle] as const,
  handleSuggestions: (base: string) => ['handle-suggestions', base] as const,
  invites: () => ['admin', 'invites'] as const,
};
