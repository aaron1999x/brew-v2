import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth/server';
import { createClient } from '@/lib/supabase/server';
import { fetchRecipeBySlug } from './fetch';

/** One fetch per request, shared by the page and its metadata. */
export const getRecipeBySlug = cache(async (handle: string, slug: string) =>
  fetchRecipeBySlug(await createClient(), handle, slug),
);

/**
 * The recipe for an owner-only page. A visitor, a missing recipe and a recipe that isn't yours all
 * end in the same "not available" page. (Public recipes for other people arrive with M6; until
 * then row-level security shows only my own.)
 */
export async function getOwnedRecipe(handle: string, slug: string) {
  const user = await getUser();
  const data = user ? await getRecipeBySlug(handle, slug) : null;
  if (!data || data.owner.id !== user?.id) notFound();
  return { data, user: user! };
}
