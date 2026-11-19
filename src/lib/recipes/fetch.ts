import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { GearSnapshot } from './gear';
import type { StepData } from './steps';

type Tables = Database['public']['Tables'];

export type RecipeRow = Tables['recipes']['Row'];
/** A saved version with its JSON columns typed. */
export type VersionRow = Omit<Tables['recipe_versions']['Row'], 'steps' | 'gear'> & {
  steps: StepData[];
  gear: GearSnapshot;
};

export type RecipeWithVersion = {
  recipe: RecipeRow;
  /** The latest version. */
  version: VersionRow;
  owner: { id: string; handle: string };
};

export function toVersionRow(row: Tables['recipe_versions']['Row']): VersionRow {
  return {
    ...row,
    steps: Array.isArray(row.steps) ? (row.steps as unknown as StepData[]) : [],
    gear:
      row.gear && typeof row.gear === 'object' && !Array.isArray(row.gear)
        ? (row.gear as unknown as GearSnapshot)
        : {},
  };
}

/**
 * A recipe and its latest version by `/@handle/slug`. Returns null when there is no such recipe
 * *or* when row-level security hides it (private, hidden, deleted): the caller can't tell which,
 * and must show the same "not available" page for both. Throws only on real failures.
 */
export async function fetchRecipeBySlug(
  supabase: SupabaseClient<Database>,
  handle: string,
  slug: string,
): Promise<RecipeWithVersion | null> {
  const profile = await supabase
    .from('profiles')
    .select('id, handle')
    .eq('handle', handle.toLowerCase())
    .maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data) return null;

  const recipe = await supabase
    .from('recipes')
    .select('*')
    .eq('owner_id', profile.data.id)
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();
  if (recipe.error) throw recipe.error;
  if (!recipe.data || !recipe.data.latest_version_id) return null;

  const version = await supabase
    .from('recipe_versions')
    .select('*')
    .eq('id', recipe.data.latest_version_id)
    .maybeSingle();
  if (version.error) throw version.error;
  if (!version.data) return null;

  return {
    recipe: recipe.data,
    version: toVersionRow(version.data),
    owner: { id: profile.data.id, handle: profile.data.handle },
  };
}
