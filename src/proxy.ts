import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/session';

// Next.js 16 renamed "middleware" to "proxy". It only refreshes the Supabase session here;
// authorisation stays in row-level security, not in the proxy.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets, the service worker (/serwist/*), the offline page, the manifest and images.
    '/((?!_next/static|_next/image|favicon.ico|serwist/|~offline|manifest\\.webmanifest|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
