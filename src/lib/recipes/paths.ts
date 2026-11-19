/**
 * Public URLs use `/@handle/…`; the app routes them internally to `/u/<handle>/…` (the proxy
 * rewrites). Both directions live here so they stay in step.
 */

/** `/@handle/recipe-slug`: the one URL for a recipe, for everyone. */
export function recipePath(handle: string, slug: string): string {
  return `/@${handle}/${slug}`;
}

export type AtPath = { handle: string; rest: string };

/** `/@Handle/a/b` → `{ handle: 'Handle', rest: '/a/b' }`; null when the path isn't an `@` path. */
export function parseAtPath(pathname: string): AtPath | null {
  const match = /^\/@([^/]+)(\/.*)?$/.exec(pathname);
  if (!match) return null;
  return { handle: decodeURIComponent(match[1]!), rest: match[2] ?? '' };
}

/** `/u/handle/a/b` → `{ handle: 'handle', rest: '/a/b' }`; null when it isn't an internal path. */
export function parseInternalPath(pathname: string): AtPath | null {
  const match = /^\/u\/([^/]+)(\/.*)?$/.exec(pathname);
  if (!match) return null;
  return { handle: match[1]!, rest: match[2] ?? '' };
}

/** The internal route for an `@` path (what the proxy rewrites to). */
export function toInternalPath({ handle, rest }: AtPath): string {
  return `/u/${handle.toLowerCase()}${rest}`;
}

/** The public `@` URL path for an internal path (where direct `/u/…` visits are sent). */
export function toAtPath({ handle, rest }: AtPath): string {
  return `/@${handle.toLowerCase()}${rest}`;
}
