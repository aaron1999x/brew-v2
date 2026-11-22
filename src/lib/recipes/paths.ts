/**
 * Public URLs use `/@handle/…`; the app routes them internally to `/u/<handle>/…` (the proxy
 * rewrites). Both directions live here so they stay in step.
 */

/** `/@handle/recipe-slug`: the one URL for a recipe, for everyone. */
export function recipePath(handle: string, slug: string): string {
  return `/@${handle}/${slug}`;
}

/** `/@handle/slug/v/3`: a specific version. */
export function versionPath(handle: string, slug: string, versionNo: number): string {
  return `${recipePath(handle, slug)}/v/${versionNo}`;
}

/** The latest version's URL, or `/v/N` for an older one. */
export function versionOrLatestPath(
  handle: string,
  slug: string,
  versionNo: number,
  latestNo: number,
): string {
  return versionNo === latestNo ? recipePath(handle, slug) : versionPath(handle, slug, versionNo);
}

/** `/@handle/slug/edit?v=3` */
export function editPath(handle: string, slug: string, versionNo: number): string {
  return `${recipePath(handle, slug)}/edit?v=${versionNo}`;
}

/** `/@handle/slug/new-version?from=3`, with `&brew=<id>` to start from what a brew said to change. */
export function newVersionPath(handle: string, slug: string, fromNo: number, brewId?: string): string {
  const base = `${recipePath(handle, slug)}/new-version?from=${fromNo}`;
  return brewId ? `${base}&brew=${encodeURIComponent(brewId)}` : base;
}

/** `/@handle/slug/versions` */
export function versionsPath(handle: string, slug: string): string {
  return `${recipePath(handle, slug)}/versions`;
}

/** `/@handle/slug/compare?a=1&b=2` (or without the versions, for the page's defaults). */
export function comparePath(handle: string, slug: string, a?: number, b?: number): string {
  const base = `${recipePath(handle, slug)}/compare`;
  return a != null && b != null ? `${base}?a=${a}&b=${b}` : base;
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
