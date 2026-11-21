'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/useSession';
import { reportUnexpected } from '@/lib/errors/report';
import { queryKeys } from '@/lib/query/keys';
import { toVersionRow, type VersionRow } from '@/lib/recipes/fetch';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';
import { PRESET_FLAVOURS, normalizeFlavours, type BrewLogForm, type LogBrewPayload } from './schema';

export type BrewRow = Database['public']['Tables']['brews']['Row'];

/** A brew with the recipe and version it was made from, when they are still there. */
export type BrewDetailData = {
  brew: BrewRow;
  /** Null when the recipe was deleted (the page then reads from the brew's snapshots). */
  recipe: { slug: string; name: string } | null;
  /** Null when the version is gone. */
  version: VersionRow | null;
};

type DetailQueryRow = BrewRow & {
  recipe: { slug: string; name: string; deleted_at: string | null } | null;
  version: Database['public']['Tables']['recipe_versions']['Row'] | null;
};

/** A brew by id, or null when it doesn't exist, was deleted, or isn't mine (the same answer for all). */
export async function fetchBrew(id: string): Promise<BrewDetailData | null> {
  const { data, error } = await createClient()
    .from('brews')
    .select('*, recipe:recipes(slug, name, deleted_at), version:recipe_versions(*)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { recipe, version, ...brew } = data as unknown as DetailQueryRow;
  const recipeAlive = recipe && !recipe.deleted_at;
  return {
    brew: brew as BrewRow,
    recipe: recipeAlive ? { slug: recipe.slug, name: recipe.name } : null,
    version: recipeAlive && version ? toVersionRow(version) : null,
  };
}

export function useBrew(id: string) {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.brew(id),
    enabled: Boolean(user),
    queryFn: () => fetchBrew(id),
  });
}

/** Everything a brew can change the screens of: the lists, the counts, and (a quick change) the recipe. */
function useInvalidateBrews() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['brews'] }),
      queryClient.invalidateQueries({ queryKey: ['brew'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.brewStats() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.flavourTags() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.recipePages() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all() }),
    ]);
}

/**
 * `log_brew`: logs the brew (and, with a quick change, the new version) in one transaction. The brew
 * id is the session's, so a retry after a dropped connection is the same brew. The caller shows
 * errors next to the form.
 */
export function useLogBrew() {
  const invalidate = useInvalidateBrews();
  return useMutation({
    mutationFn: async (payload: LogBrewPayload): Promise<BrewRow> => {
      const { data, error } = await createClient().rpc('log_brew', {
        p_brew: payload.brew as never,
        p_new_version: (payload.newVersion ?? undefined) as never,
      });
      if (error) throw error;
      return data as BrewRow;
    },
    onError: (error) => reportUnexpected(error),
    onSuccess: () => invalidate(),
  });
}

const orNull = (text: string): string | null => (text.trim() === '' ? null : text);

/** The columns an edit may change (the database refuses the rest). */
export function brewUpdateColumns(form: BrewLogForm): Database['public']['Tables']['brews']['Update'] {
  return {
    brewed_at: new Date(form.brewedAt).toISOString(),
    drawdown_s: form.drawdownS,
    beverage_g: form.beverageG,
    tds_pct: form.tdsPct,
    sweetness: form.sweetness,
    acidity: form.acidity,
    brightness: form.brightness,
    body: form.body,
    clarity: form.clarity,
    balance: form.balance,
    aftertaste: form.aftertaste,
    overall: form.overall ?? undefined,
    flavours: normalizeFlavours(form.flavours),
    tasted_temp: form.tastedTemp,
    tasted_after_min: form.tastedAfterMin,
    notes: orNull(form.notes),
    next_change: orNull(form.nextChange),
    client_updated_at: new Date().toISOString(),
  };
}

/** A normal update of an existing brew (row-level security and the guard trigger apply). */
export function useUpdateBrew() {
  const invalidate = useInvalidateBrews();
  return useMutation({
    mutationFn: async (input: { id: string; form: BrewLogForm }): Promise<BrewRow> => {
      const { data, error } = await createClient()
        .from('brews')
        .update(brewUpdateColumns(input.form))
        .eq('id', input.id)
        .is('deleted_at', null)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onError: (error) => reportUnexpected(error),
    onSuccess: () => invalidate(),
  });
}

/** Soft delete (the version stays locked) and its undo. */
export function useDeleteBrew() {
  const invalidate = useInvalidateBrews();
  const set = async (id: string, deletedAt: string | null) => {
    const { error } = await createClient().from('brews').update({ deleted_at: deletedAt }).eq('id', id);
    if (error) throw error;
  };
  const remove = useMutation({
    mutationFn: (id: string) => set(id, new Date().toISOString()),
    onError: (error) => reportUnexpected(error),
    onSuccess: () => invalidate(),
  });
  const restore = useMutation({
    mutationFn: (id: string) => set(id, null),
    onError: (error) => reportUnexpected(error),
    onSuccess: () => invalidate(),
  });
  return { remove, restore };
}

const RECENT_BREWS = 50;
const RECENT_TAGS = 8;

/** The custom flavour tags (not presets) of my latest brews, newest first, without repeats. */
export function recentCustomTags(rows: readonly { flavours: string[] }[]): string[] {
  const presets = new Set(PRESET_FLAVOURS.map((p) => p.toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    for (const tag of row.flavours) {
      const key = tag.trim().toLowerCase();
      if (!key || presets.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push(tag.trim());
      if (out.length >= RECENT_TAGS) return out;
    }
  }
  return out;
}

/** My recent custom flavour tags, worked out on the device from my last 50 brews. */
export function useRecentFlavourTags() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.flavourTags(),
    enabled: Boolean(user),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await createClient()
        .from('brews')
        .select('flavours')
        .is('deleted_at', null)
        .order('brewed_at', { ascending: false })
        .limit(RECENT_BREWS);
      if (error) throw error;
      return recentCustomTags(data);
    },
  });
}
