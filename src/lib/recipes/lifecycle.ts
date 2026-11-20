'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/Toast/toast';
import { toUserMessage } from '@/lib/errors/messages';
import { reportUnexpected } from '@/lib/errors/report';
import { queryKeys } from '@/lib/query/keys';
import { createClient } from '@/lib/supabase/client';
import { duplicateValues } from './duplicate';
import { fetchRecipeBySlug, versionByNo, type RecipeRow, type RecipeWithVersion } from './fetch';
import { createRecipeRpc } from './hooks';
import type { RecipeListItem } from './list';

/**
 * Archive, restore, delete and duplicate. Archive, restore and delete show at once and roll back if
 * the save fails; archiving and deleting offer Undo. Deleting is soft (`deleted_at`): the recipe
 * disappears everywhere, and its URL becomes the "not available" page, but Undo can bring it back.
 */

type Snapshot = {
  lists: [readonly unknown[], RecipeListItem[] | undefined][];
  recipes: [readonly unknown[], RecipeWithVersion | null | undefined][];
};

/** Applies a change to every cached copy of the list and of the recipe page, and returns the old ones. */
function patchCaches(
  queryClient: QueryClient,
  id: string,
  change: { list: (item: RecipeListItem) => RecipeListItem | null; recipe: (r: RecipeRow) => RecipeRow | null },
): Snapshot {
  const snapshot: Snapshot = {
    lists: queryClient.getQueriesData<RecipeListItem[]>({ queryKey: queryKeys.recipes.mine() }),
    recipes: queryClient.getQueriesData<RecipeWithVersion | null>({ queryKey: queryKeys.recipePages() }),
  };
  queryClient.setQueriesData<RecipeListItem[]>({ queryKey: queryKeys.recipes.mine() }, (items) =>
    items?.flatMap((item) => {
      if (item.id !== id) return [item];
      const next = change.list(item);
      return next ? [next] : [];
    }),
  );
  queryClient.setQueriesData<RecipeWithVersion | null>({ queryKey: queryKeys.recipePages() }, (data) => {
    if (!data || data.recipe.id !== id) return data;
    const next = change.recipe(data.recipe);
    return next ? { ...data, recipe: next } : null;
  });
  return snapshot;
}

function restore(queryClient: QueryClient, snapshot: Snapshot | undefined) {
  if (!snapshot) return;
  for (const [key, data] of snapshot.lists) queryClient.setQueryData(key, data);
  for (const [key, data] of snapshot.recipes) queryClient.setQueryData(key, data);
}

function refresh(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.recipePages() }),
  ]);
}

async function cancelRecipeQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: queryKeys.recipes.all() }),
    queryClient.cancelQueries({ queryKey: queryKeys.recipePages() }),
  ]);
}

function failed(error: unknown, retry: () => void) {
  reportUnexpected(error);
  toast.error(toUserMessage(error), { onRetry: retry });
}

/** Shown instead of acting when there is no connection: these changes need one. */
export const RECIPE_OFFLINE_MESSAGE = 'Changing recipes needs a connection';

export type ArchiveInput = { id: string; name: string; archived: boolean };

/** Archive (with Undo) or restore. The recipe moves between the Recipes and Archived tabs at once. */
export function useArchiveRecipe() {
  const queryClient = useQueryClient();
  const mutation = useMutation<void, unknown, ArchiveInput, { snapshot: Snapshot }>({
    // Without a connection the save must fail (and roll back), not wait quietly with the list changed.
    networkMode: 'always',
    mutationFn: async ({ id, archived }) => {
      const { error } = await createClient()
        .from('recipes')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, archived }) => {
      await cancelRecipeQueries(queryClient);
      const archivedAt = archived ? new Date().toISOString() : null;
      return {
        snapshot: patchCaches(queryClient, id, {
          list: (item) => ({ ...item, archived_at: archivedAt }),
          recipe: (r) => ({ ...r, archived_at: archivedAt }),
        }),
      };
    },
    onError: (error, input, context) => {
      restore(queryClient, context?.snapshot);
      failed(error, () => mutation.mutate(input));
    },
    onSuccess: (_data, input) => {
      if (input.archived) {
        toast.undo(`Archived ${input.name}`, () => mutation.mutate({ ...input, archived: false }));
      } else {
        toast.success(`Restored ${input.name}`);
      }
    },
    onSettled: () => refresh(queryClient),
  });
  return mutation;
}

export type DeleteInput = { id: string; name: string; deleted: boolean };

/**
 * Soft delete (with Undo) or the undo itself. A deleted recipe leaves the list and every cached
 * page at once; row-level security still lets its owner clear `deleted_at`.
 */
export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  const mutation = useMutation<void, unknown, DeleteInput, { snapshot: Snapshot }>({
    networkMode: 'always',
    mutationFn: async ({ id, deleted }) => {
      const { error } = await createClient()
        .from('recipes')
        .update({ deleted_at: deleted ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, deleted }) => {
      await cancelRecipeQueries(queryClient);
      // Undoing a delete has nothing to show until the refetch brings the recipe back.
      return {
        snapshot: deleted
          ? patchCaches(queryClient, id, { list: () => null, recipe: () => null })
          : { lists: [], recipes: [] },
      };
    },
    onError: (error, input, context) => {
      restore(queryClient, context?.snapshot);
      failed(error, () => mutation.mutate(input));
    },
    onSuccess: (_data, input) => {
      if (input.deleted) {
        toast.undo(`Deleted ${input.name}`, () => mutation.mutate({ ...input, deleted: false }));
      } else {
        toast.success(`Restored ${input.name}`);
      }
    },
    onSettled: () => refresh(queryClient),
  });
  return mutation;
}

export type DuplicateInput = {
  handle: string;
  slug: string;
  /** The version to copy; the latest when left out. */
  versionNo?: number | null;
};

/**
 * Copies one version into a new private recipe "<name> (copy)" (as its v1, with the change note
 * "Duplicated from <name> v3") and returns it. The caller opens it.
 */
export function useDuplicateRecipe() {
  const queryClient = useQueryClient();
  const mutation = useMutation<RecipeRow, unknown, DuplicateInput>({
    networkMode: 'always',
    mutationFn: async ({ handle, slug, versionNo }) => {
      const found = await fetchRecipeBySlug(createClient(), handle, slug);
      const version = found ? versionByNo(found.versions, versionNo ?? null) : null;
      if (!found || !version) throw new Error('recipe_not_found');
      return createRecipeRpc(duplicateValues(found.recipe, version));
    },
    onError: (error, input) => failed(error, () => mutation.mutate(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all() }),
  });
  return mutation;
}
