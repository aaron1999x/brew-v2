import { NextResponse, type NextRequest } from 'next/server';
import { isGuestOnlyPath, isProtectedPath, isTokenForward } from '@/lib/auth/routes';
import { parseAtPath, parseInternalPath, toAtPath, toInternalPath } from '@/lib/recipes/paths';
import { updateSession } from '@/lib/supabase/session';

// Next.js 16 renamed "middleware" to "proxy". It refreshes the Supabase session and does the
// optimistic route gating; authorisation stays in row-level security and in server components
// (requireUser / requireAdmin), so this is never the only gate.
export async function proxy(request: NextRequest) {
  const { nextUrl } = request;
  const { pathname } = nextUrl;

  // An email link whose redirect Supabase rejected falls back to the Site URL ("/"). Forward it
  // to our confirm page with the same query. The confirm page itself verifies nothing on GET.
  if (isTokenForward(pathname, nextUrl.searchParams)) {
    const target = nextUrl.clone();
    target.pathname = '/auth/confirm';
    return NextResponse.redirect(target);
  }

  const { response, claims, withSessionCookies } = await updateSession(request);

  // `/@handle/…` is the public URL; the app serves it from the internal `/u/<handle>/…` segment.
  // Rewrites don't run the proxy again, so a `/u/…` request here is a direct visit: send it to the
  // `@` URL. A handle with capital letters goes to the lowercase one. These paths aren't gated
  // here: row-level security decides what a visitor can see.
  const atPath = parseAtPath(pathname);
  if (atPath) {
    if (atPath.handle !== atPath.handle.toLowerCase()) {
      const target = nextUrl.clone();
      target.pathname = toAtPath(atPath);
      return withSessionCookies(NextResponse.redirect(target, 308));
    }
    const target = nextUrl.clone();
    target.pathname = toInternalPath(atPath);
    return withSessionCookies(NextResponse.rewrite(target));
  }
  const internalPath = parseInternalPath(pathname);
  if (internalPath) {
    const target = nextUrl.clone();
    target.pathname = toAtPath(internalPath);
    return withSessionCookies(NextResponse.redirect(target, 308));
  }

  if (!claims && isProtectedPath(pathname)) {
    const target = nextUrl.clone();
    target.pathname = '/login';
    target.search = '';
    target.searchParams.set('next', `${pathname}${nextUrl.search}`);
    return withSessionCookies(NextResponse.redirect(target));
  }

  if (claims && (pathname === '/' || isGuestOnlyPath(pathname))) {
    const target = nextUrl.clone();
    target.pathname = '/home';
    target.search = '';
    return withSessionCookies(NextResponse.redirect(target));
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets, the service worker (/serwist/*), the offline page, the manifest and images.
    '/((?!_next/static|_next/image|favicon.ico|serwist/|~offline|manifest\\.webmanifest|robots\\.txt|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
