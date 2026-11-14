import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getPublicEnv } from '@/lib/env';
import { getServerEnv } from '@/lib/env.server';

/**
 * Secret-key client. BYPASSES row-level security. Server code only (account deletion, export);
 * `server-only` makes the build fail if a client component imports this file.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
    getServerEnv().SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
