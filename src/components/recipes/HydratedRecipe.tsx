import type { ReactNode } from 'react';
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { getOwnedRecipe } from '@/lib/recipes/server';

/**
 * Fetches the recipe (all its versions) on the server, checks it is mine (otherwise the shared
 * "not available" page), and hands it to the client's cache so the screen below has no second
 * loading state.
 */
export async function HydratedRecipe({
  handle,
  slug,
  children,
}: Readonly<{ handle: string; slug: string; children: ReactNode }>) {
  const { data } = await getOwnedRecipe(handle, slug);
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.recipe(handle, slug), data);
  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}
