import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth/server';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks that a brew is mine and not deleted, for the brew pages. Someone else's brew, a deleted
 * one, a missing one and a bad id all end in the same "not available" 404 (row-level security
 * already hides other people's rows, so the answer is the same for all of them).
 */
export const requireOwnBrew = cache(async (id: string): Promise<void> => {
  const user = await getUser();
  if (!user || !UUID.test(id)) notFound();
  const { data, error } = await (await createClient())
    .from('brews')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !data) notFound();
});
