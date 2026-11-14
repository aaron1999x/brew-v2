'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { THEME_COOKIE } from '@/lib/settings/theme';
import { createClient } from '@/lib/supabase/server';

/** Ends the session on the server (clears the cookies), then goes to the log-in screen. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Visitors follow the system theme, so the signed-in person's choice doesn't stay behind.
  (await cookies()).delete(THEME_COOKIE);
  redirect('/login?notice=signed-out');
}
