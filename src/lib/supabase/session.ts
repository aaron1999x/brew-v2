import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { getPublicEnv } from '@/lib/env';

export type SessionResult = {
  /** The response carrying any refreshed session cookies. */
  response: NextResponse;
  /** The validated JWT claims, or null for a visitor. */
  claims: { sub: string } | null;
  /** Copy refreshed session cookies and cache headers onto another response (a redirect). */
  withSessionCookies: (target: NextResponse) => NextResponse;
};

/**
 * Refreshes the Supabase session cookies for a request. Called from the root proxy
 * (src/proxy.ts) so server components always see a fresh session.
 *
 * `getClaims()` validates the JWT (it does not trust the cookie blindly) and triggers the
 * token refresh when needed. Do not run other logic between creating the client and this call.
 */
export async function updateSession(request: NextRequest): Promise<SessionResult> {
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

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims?.sub ? { sub: data.claims.sub as string } : null;

  return {
    response,
    claims,
    withSessionCookies(target) {
      for (const cookie of response.cookies.getAll()) target.cookies.set(cookie);
      for (const [key, value] of response.headers.entries()) {
        if (
          key.toLowerCase() === 'cache-control' ||
          key.toLowerCase() === 'expires' ||
          key.toLowerCase() === 'pragma'
        ) {
          target.headers.set(key, value);
        }
      }
      return target;
    },
  };
}
