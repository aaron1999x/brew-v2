'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/useSession';
import { queryKeys } from '@/lib/query/keys';
import { createClient } from '@/lib/supabase/client';

export type BrewStatRow = {
  recipe_id: string;
  recipe_version_id: string;
  brew_count: number;
  last_brewed_at: string;
};

export type RecipeBrewStats = { count: number; lastBrewedAt: string | null };

/** Per recipe: how many brews and when the last one was (the database groups by version; this sums). */
export function summariseByRecipe(rows: readonly BrewStatRow[]): Map<string, RecipeBrewStats> {
  const out = new Map<string, RecipeBrewStats>();
  for (const row of rows) {
    const current = out.get(row.recipe_id);
    const last =
      current?.lastBrewedAt && current.lastBrewedAt > row.last_brewed_at
        ? current.lastBrewedAt
        : row.last_brewed_at;
    out.set(row.recipe_id, { count: (current?.count ?? 0) + row.brew_count, lastBrewedAt: last });
  }
  return out;
}

/** Brew counts and last-brewed dates from `my_recipe_brew_stats` (soft-deleted brews don't count). */
export function useBrewStats() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.brewStats(),
    enabled: Boolean(user),
    queryFn: async (): Promise<BrewStatRow[]> => {
      const { data, error } = await createClient().rpc('my_recipe_brew_stats');
      if (error) throw error;
      return data;
    },
  });
}

/** "Brewed 4×" or "Not brewed yet". */
export function brewCountText(count: number | undefined): string {
  return count ? `Brewed ${count}×` : 'Not brewed yet';
}
