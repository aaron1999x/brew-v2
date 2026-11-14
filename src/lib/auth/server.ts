import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanitizeNext } from '@/lib/auth/redirect';

/** The signed-in user (validated by Supabase Auth, not just read from the cookie), or null. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/** Role and suspension of the signed-in user, or null for a visitor. */
export const getAccountStatus = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('account_status')
    .select('role, suspended_at, suspended_reason')
    .eq('user_id', user.id)
    .maybeSingle();
  return data;
});

/**
 * For server components behind a login. The proxy already redirects visitors; this is the real
 * gate. `next` (optional, relative path) is where to come back to after logging in.
 */
export async function requireUser(next?: string) {
  const user = await getUser();
  if (!user) {
    const safe = sanitizeNext(next);
    redirect(safe ? `/login?next=${encodeURIComponent(safe)}` : '/login');
  }
  return user;
}

/** Admin-only screens: anyone else, signed in or not, gets the 404 page. */
export async function requireAdmin() {
  const user = await getUser();
  const status = await getAccountStatus();
  if (!user || status?.role !== 'admin' || status.suspended_at) notFound();
  return user;
}
