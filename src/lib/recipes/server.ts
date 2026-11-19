import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { fetchRecipeBySlug } from './fetch';

/** One fetch per request, shared by the page and its metadata. */
export const getRecipeBySlug = cache(async (handle: string, slug: string) =>
  fetchRecipeBySlug(await createClient(), handle, slug),
);
