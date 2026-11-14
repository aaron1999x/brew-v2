/**
 * Which paths need a session, and which are for logged-out visitors only.
 * Used by the proxy (an optimistic gate); server components still check the user themselves.
 *
 * `/verified` is deliberately NOT protected: docs/phase-2-ia-flows.md says it is public so share
 * links and the landing page can point to it, even though the page lives in the (app) group.
 */
export const PROTECTED_PREFIXES = [
  '/home',
  '/recipes',
  '/brew',
  '/profile',
  '/welcome',
  '/settings',
  '/admin',
] as const;

/** Visitors only: a logged-in user who opens these goes to /home. */
export const GUEST_ONLY_PATHS = ['/login', '/signup', '/forgot-password'] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

/** `/signup/check-email` is guest-only too (it is part of the sign-up flow). */
export function isGuestOnlyPath(pathname: string): boolean {
  return GUEST_ONLY_PATHS.some((path) => matchesPrefix(pathname, path));
}

/** Email links that fell back to the Site URL land on "/" with these two query parameters. */
export function isTokenForward(pathname: string, search: URLSearchParams): boolean {
  return pathname === '/' && search.has('token_hash') && search.has('type');
}
