/**
 * Redirect safety for auth flows: the `next` / `return_to` sanitiser and the origin check for
 * email links. Pure functions (no env access) so they are easy to unit-test.
 */

const MAX_PATH_LENGTH = 500;
// ASCII control characters (including tab, CR, LF) and DEL.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Returns `input` if it is a safe relative path on this site, else null. Rules: a string that
 * starts with a single "/" (so no scheme, no "//host"), no backslash (browsers treat "\" as "/"),
 * no control characters, not absurdly long.
 */
export function sanitizeNext(input: string | null | undefined): string | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_PATH_LENGTH)
    return null;
  if (!input.startsWith('/')) return null;
  if (input.startsWith('//')) return null;
  if (input.includes('\\')) return null;
  if (CONTROL_CHARS.test(input)) return null;
  // "/%5C/evil.com" and "/%2F/evil.com" stay on this origin as literal paths, but "/\t/" style
  // tricks are already rejected above. Also refuse anything that URL parsing resolves elsewhere.
  try {
    const parsed = new URL(input, 'http://localhost');
    if (parsed.origin !== 'http://localhost') return null;
  } catch {
    return null;
  }
  return input;
}

export type OriginConfig = {
  /** NEXT_PUBLIC_APP_ENV */
  appEnv: 'local' | 'staging' | 'production';
  /** NEXT_PUBLIC_SITE_URL */
  siteUrl: string;
};

const LOCALHOST = /^http:\/\/localhost:\d{1,5}$/;
// Vercel preview deployments of this project: brew-v2-<hash>-aaron1999xs-projects.vercel.app
const PREVIEW = /^https:\/\/brew-v2-[a-z0-9-]+-aaron1999xs-projects\.vercel\.app$/;

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * May a link in an auth email point at this origin?
 * Production: only the configured site URL. Everywhere else: the site URL, localhost and this
 * project's Vercel previews.
 */
export function isAllowedOrigin(origin: string, config: OriginConfig): boolean {
  const normalised = originOf(origin);
  if (!normalised || normalised !== origin.replace(/\/$/, '')) return false;
  if (normalised === originOf(config.siteUrl)) return true;
  if (config.appEnv === 'production') return false;
  return LOCALHOST.test(normalised) || PREVIEW.test(normalised);
}

/** The origin to put in email links: the current one when allowed, else the site URL. */
export function resolveOrigin(candidate: string | null | undefined, config: OriginConfig): string {
  if (candidate && isAllowedOrigin(candidate, config)) return candidate.replace(/\/$/, '');
  return originOf(config.siteUrl) ?? config.siteUrl;
}

/** Where email links land: our own confirm route on the (allowed) current origin. */
export function authConfirmUrl(candidateOrigin: string | null | undefined, config: OriginConfig) {
  return `${resolveOrigin(candidateOrigin, config)}/auth/confirm`;
}
