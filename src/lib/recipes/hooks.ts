'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toUserMessage } from '@/lib/errors/messages';
import { reportUnexpected } from '@/lib/errors/report';
import { queryKeys } from '@/lib/query/keys';
import { createClient } from '@/lib/supabase/client';
import { fetchRecipeBySlug, type RecipeRow, type RecipeWithVersion } from './fetch';
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

/**
 * Saves a new recipe as v1 (`create_recipe`) and returns the recipe row, which carries the slug.
 * The caller shows the error next to the form, so this hook doesn't toast.
 */
export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: RecipeFormValues): Promise<RecipeRow> => {
      const args = toRecipeRpcArgs(values);
      const { data, error } = await createClient().rpc('create_recipe', {
        ...args,
        // The generated type has no null for the custom method name; the database accepts null.
        p_method_custom: args.p_method_custom as string,
        p_version: args.p_version as never,
      });
      if (error) throw error;
      return data as RecipeRow;
    },
    onError: (error) => reportUnexpected(error),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

/** The message to show for a failed save. */
export function saveErrorMessage(error: unknown): string {
  return toUserMessage(error);
}
