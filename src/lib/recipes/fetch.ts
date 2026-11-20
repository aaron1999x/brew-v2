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
  /** Every version, newest first (the latest is the first). */
  versions: VersionRow[];
  owner: { id: string; handle: string };
};

/** One version of a recipe by its number, or null. */
export function versionByNo(
  versions: readonly VersionRow[],
  versionNo: number | null | undefined,
): VersionRow | null {
  if (versionNo == null) return versions[0] ?? null;
  return versions.find((v) => v.version_no === versionNo) ?? null;
}

/** "3" → 3; anything that isn't a whole version number (0, 2.5, "x", "") → null. */
export function parseVersionNo(value: string | string[] | null | undefined): number | null {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text || !/^[1-9]\d{0,5}$/.test(text)) return null;
  return Number(text);
}

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
  const recipeRow = recipe.data;
  if (!recipeRow?.latest_version_id) return null;

  // Every version (a recipe has a handful), newest first. The latest is the one the recipe points to.
  const rows = await supabase
    .from('recipe_versions')
    .select('*')
    .eq('recipe_id', recipeRow.id)
    .order('version_no', { ascending: false });
  if (rows.error) throw rows.error;
  const versions = rows.data.map(toVersionRow);
  const latest = versions.find((v) => v.id === recipeRow.latest_version_id) ?? versions[0];
  if (!latest) return null;

  return {
    recipe: recipeRow,
    version: latest,
    versions,
    owner: { id: profile.data.id, handle: profile.data.handle },
  };
}
