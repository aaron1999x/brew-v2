import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { RecipePage } from '@/components/recipes/RecipePage';
import { getUser } from '@/lib/auth/server';
import { queryKeys } from '@/lib/query/keys';
import { getRecipeBySlug } from '@/lib/recipes/server';

type Params = { handle: string; slug: string };

/** Private recipes must not be indexed, and their title only shows to the owner. */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { handle, slug } = await params;
  const user = await getUser();
  const data = user ? await getRecipeBySlug(handle, slug) : null;
  return {
    title: data?.owner.id === user?.id && data ? data.recipe.name : 'Not available',
    robots: { index: false, follow: false },
  };
}

export default async function RecipeRoute({ params }: { params: Promise<Params> }) {
  const { handle, slug } = await params;
  const user = await getUser();
  // A visitor, a missing recipe and a recipe that isn't theirs all end in the same page. (Public
  // recipes for other people arrive with M6; until then row-level security shows only my own.)
  const data = user ? await getRecipeBySlug(handle, slug) : null;
  if (!data || data.owner.id !== user?.id) notFound();

  // Hand the fetched recipe to the client's cache so the page has no second loading state.
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.recipe(handle, slug), data);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RecipePage handle={handle} slug={slug} />
    </HydrationBoundary>
  );
}
