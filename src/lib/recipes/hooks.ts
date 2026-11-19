'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toUserMessage } from '@/lib/errors/messages';
import { reportUnexpected } from '@/lib/errors/report';
import { useSession } from '@/lib/auth/useSession';
import { queryKeys } from '@/lib/query/keys';
import { createClient } from '@/lib/supabase/client';
import {
  fetchRecipeBySlug,
  toVersionRow,
  type RecipeRow,
  type RecipeWithVersion,
  type VersionRow,
} from './fetch';
import type { RecipeListItem } from './list';
import { toRecipeRpcArgs, type RecipeFormValues } from './schema';

/**
 * One recipe and its latest version (query key `['recipe', handle, slug]`). The recipe page's
 * server component fetches it first and hands it over, so there is no second loading state.
 */
export function useRecipe(handle: string, slug: string) {
  return useQuery({
    queryKey: queryKeys.recipe(handle, slug),
    queryFn: async (): Promise<RecipeWithVersion | null> =>
      fetchRecipeBySlug(createClient(), handle, slug),
  });
}

/** `create_recipe`: a new private recipe with these values as its v1. Returns the recipe row. */
export async function createRecipeRpc(values: RecipeFormValues): Promise<RecipeRow> {
  const args = toRecipeRpcArgs(values);
  const { data, error } = await createClient().rpc('create_recipe', {
    ...args,
    // The generated type has no null for the custom method name; the database accepts null.
    p_method_custom: args.p_method_custom as string,
    p_version: args.p_version as never,
  });
  if (error) throw error;
  return data as RecipeRow;
}

/**
 * Saves a new recipe as v1 (`create_recipe`) and returns the recipe row, which carries the slug.
 * The caller shows the error next to the form, so this hook doesn't toast.
 */
export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRecipeRpc,
    onError: (error) => reportUnexpected(error),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

const LIST_COLUMNS =
  'id, slug, name, method, method_custom, visibility, archived_at, edited_at, last_brewed_at, latest_version_no, latest:recipe_versions!recipes_latest_version_fk(dose_g, brew_water_g, bypass_g, coffee_name, roaster, origin)';

type ListRow = Omit<
  RecipeListItem,
  'dose_g' | 'brew_water_g' | 'bypass_g' | 'coffee_name' | 'roaster' | 'origin'
> & {
  latest: Pick<
    RecipeListItem,
    'dose_g' | 'brew_water_g' | 'bypass_g' | 'coffee_name' | 'roaster' | 'origin'
  > | null;
};

/**
 * Every recipe of mine that isn't deleted, archived ones included (query key `['recipes','mine',{}]`).
 * Search, filters, sort and the Archived tab run on the device over this list.
 */
export function useMyRecipes() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.recipes.mine(),
    enabled: Boolean(user),
    queryFn: async (): Promise<RecipeListItem[]> => {
      const { data, error } = await createClient()
        .from('recipes')
        .select(LIST_COLUMNS)
        .eq('owner_id', user!.id)
        .is('deleted_at', null)
        .order('edited_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as ListRow[]).map(({ latest, ...recipe }) => ({
        ...recipe,
        dose_g: latest?.dose_g ?? null,
        brew_water_g: latest?.brew_water_g ?? null,
        bypass_g: latest?.bypass_g ?? null,
        coffee_name: latest?.coffee_name ?? null,
        roaster: latest?.roaster ?? null,
        origin: latest?.origin ?? null,
      }));
    },
  });
}

/**
 * Saves an edit through `save_recipe`: in place on the version being edited, or as the next
 * version. Name, method and the version change in one transaction. Returns the saved version.
 * Like creating, the caller shows the error next to the form.
 */
export function useSaveRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      recipeId: string;
      baseVersionId: string;
      values: RecipeFormValues;
      asNewVersion: boolean;
    }): Promise<VersionRow> => {
      const args = toRecipeRpcArgs(input.values);
      const { data, error } = await createClient().rpc('save_recipe', {
        p_recipe_id: input.recipeId,
        p_base_version_id: input.baseVersionId,
        p_name: args.p_name,
        p_method: args.p_method,
        // The generated type has no null for the custom method name; the database accepts null.
        p_method_custom: args.p_method_custom as string,
        p_version: args.p_version as never,
        p_as_new_version: input.asNewVersion,
      });
      if (error) throw error;
      return toVersionRow(data);
    },
    onError: (error) => reportUnexpected(error),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recipe'] }),
        queryClient.invalidateQueries({ queryKey: ['recipes'] }),
      ]);
    },
  });
}

/** The message to show for a failed save. */
export function saveErrorMessage(error: unknown): string {
  return toUserMessage(error);
}
