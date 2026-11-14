import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const EXPORT_SCHEMA = 1;
const PAGE = 1000;
const ID_CHUNK = 100;

type Client = SupabaseClient<Database>;
type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Reads every row of a query, a page at a time (the API returns at most 1000 per request). */
async function fetchAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export type ExportUser = { id: string; email?: string | null; created_at?: string | null };

/**
 * The JSON a person downloads from "Download my data". `supabase` must be the SIGNED-IN user's
 * client, so row-level security applies, and every query also filters by that user's id, so
 * public rows other people own are never included. Tables that later milestones fill are
 * already here (empty until then), so those milestones don't touch the export.
 */
export async function buildExport(supabase: Client, user: ExportUser, now: Date = new Date()) {
  const id = user.id;

  const [profile, settings, status] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabase.from('user_settings').select('*').eq('user_id', id).maybeSingle(),
    supabase
      .from('account_status')
      .select('role, suspended_at, suspended_reason')
      .eq('user_id', id)
      .maybeSingle(),
  ]);
  for (const result of [profile, settings, status]) {
    if (result.error) throw new Error(result.error.message);
  }

  const [gear, recipes, brews, saved, notifications] = await Promise.all([
    fetchAll((a, b) =>
      supabase.from('gear_items').select('*').eq('user_id', id).order('id').range(a, b),
    ),
    fetchAll((a, b) =>
      supabase.from('recipes').select('*').eq('owner_id', id).order('id').range(a, b),
    ),
    fetchAll((a, b) =>
      supabase.from('brews').select('*').eq('user_id', id).order('id').range(a, b),
    ),
    fetchAll((a, b) =>
      supabase.from('saved_recipes').select('*').eq('user_id', id).order('recipe_id').range(a, b),
    ),
    fetchAll((a, b) =>
      supabase.from('notifications').select('*').eq('user_id', id).order('id').range(a, b),
    ),
  ]);

  const recipeIds = recipes.map((r) => r.id);
  const versions: Database['public']['Tables']['recipe_versions']['Row'][] = [];
  for (let i = 0; i < recipeIds.length; i += ID_CHUNK) {
    const chunk = recipeIds.slice(i, i + ID_CHUNK);
    versions.push(
      ...(await fetchAll((a, b) =>
        supabase.from('recipe_versions').select('*').in('recipe_id', chunk).order('id').range(a, b),
      )),
    );
  }

  return {
    schema: EXPORT_SCHEMA,
    exported_at: now.toISOString(),
    account: {
      email: user.email ?? null,
      created_at: user.created_at ?? null,
      role: status.data?.role ?? null,
    },
    profile: profile.data,
    settings: settings.data,
    gear,
    recipes: recipes.map((recipe) => ({
      ...recipe,
      versions: versions
        .filter((v) => v.recipe_id === recipe.id)
        .sort((a, b) => a.version_no - b.version_no),
    })),
    brews,
    saved,
    notifications,
  };
}

/** `brew-data-2026-11-14.json` */
export function exportFileName(now: Date = new Date()): string {
  return `brew-data-${now.toISOString().slice(0, 10)}.json`;
}
