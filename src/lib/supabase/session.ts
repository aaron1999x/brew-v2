import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { getPublicEnv } from '@/lib/env';

/**
 * Refreshes the Supabase session cookies for a request. Called from the root proxy
 * (src/proxy.ts) so server components always see a fresh session.
 *
 * `getClaims()` validates the JWT (it does not trust the cookie blindly) and triggers the
 * token refresh when needed. Do not run other logic between creating the client and this call.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Cache headers stop CDNs from caching a response that carries a session cookie.
          for (const [key, value] of Object.entries(headers ?? {}))
            response.headers.set(key, value);
        },
      },
    },
  );

  await supabase.auth.getClaims();
  return response;
}
