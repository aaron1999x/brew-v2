import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { deleteAccount, type PasswordCheck } from '@/lib/account/deleteAccount';
import { getPublicEnv } from '@/lib/env';
import { reportUnexpected } from '@/lib/errors/report';
import { THEME_COOKIE } from '@/lib/settings/theme';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Only requests that come from this site's own pages may delete an account. */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function verifyPassword(email: string, password: string): Promise<PasswordCheck> {
  const env = getPublicEnv();
  // A throwaway client that keeps no session: the signed-in session is not touched.
  const checker = createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { error } = await checker.auth.signInWithPassword({ email, password });
  if (!error) return 'ok';
  if (error.status === 429 || error.code === 'over_request_rate_limit') return 'rate_limited';
  if (error.code === 'invalid_credentials') return 'wrong';
  return 'error';
}

/** POST /api/account/delete { password, confirm: "DELETE" }: deletes the signed-in user's account. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    password?: unknown;
    confirm?: unknown;
  } | null;

  const admin = createAdminClient();
  const result = await deleteAccount(
    { user: { id: user.id, email: user.email }, password: body?.password, confirm: body?.confirm },
    {
      verifyPassword,
      removeAvatarFiles: async (userId) => {
        const files = await admin.storage.from('avatars').list(userId);
        if (files.error) throw files.error;
        if (files.data.length === 0) return;
        const removed = await admin.storage
          .from('avatars')
          .remove(files.data.map((f) => `${userId}/${f.name}`));
        if (removed.error) throw removed.error;
      },
      deleteUser: async (userId) => {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw error;
      },
    },
  );

  if (!result.ok) {
    if (result.code === 'delete_failed') {
      reportUnexpected(new Error('account delete failed'), { route: 'account-delete' }, true);
    }
    return NextResponse.json({ error: result.code }, { status: result.status });
  }

  // End the session on this device: the user no longer exists, so the cookies are just leftovers.
  await supabase.auth.signOut().catch(() => undefined);
  const store = await cookies();
  for (const cookie of store.getAll()) {
    if (cookie.name.startsWith('sb-') || cookie.name === THEME_COOKIE) store.delete(cookie.name);
  }
  return NextResponse.json({ ok: true });
}
