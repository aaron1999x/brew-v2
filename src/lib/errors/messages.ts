/**
 * Named errors raised by Postgres RPCs/triggers (RAISE EXCEPTION '<code>') → plain messages.
 * Source: docs/phase-4-amendments.md §3. When you add a new `raise exception 'xyz'` in a migration,
 * add 'xyz' here (CLAUDE.md rule 4).
 */
export const ERROR_MESSAGES = {
  email_not_verified: 'Verify your email before making recipes public.',
  publish_limit: 'New accounts can publish 5 recipes a day. Try again tomorrow.',
  version_locked: 'This version has brews, so your changes will be saved as a new version.',
  recipe_not_available: "This recipe isn't available any more.",
  recipe_not_found: "This recipe isn't available any more.",
  version_not_found: "This recipe isn't available any more.",
  handle_reserved: "That handle isn't available. Try another.",
  handle_recently_used: "That handle isn't available. Try another.",
  moderator_only: "You don't have permission to do that.",
  admin_only: "You don't have permission to do that.",
  immutable_field: "That can't be changed.",
  brew_version_immutable: "A brew can't be moved to another recipe version.",
  cannot_suspend_self: "You can't suspend your own account.",
  not_authenticated: 'Please log in again.',
  invite_only: 'Sign-ups are invite-only right now.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export const MESSAGE_LOGIN_AGAIN = 'Please log in again.';
export const MESSAGE_NO_PERMISSION = "You don't have permission to do that.";
export const MESSAGE_NETWORK = "Couldn't reach the server. Check your connection and try again.";
export const MESSAGE_FALLBACK = 'Something went wrong. Try again.';

const KNOWN_CODES = Object.keys(ERROR_MESSAGES) as ErrorCode[];

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  status?: unknown;
  details?: unknown;
  hint?: unknown;
};

function asErrorLike(error: unknown): ErrorLike | null {
  return typeof error === 'object' && error !== null ? (error as ErrorLike) : null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** The named code raised by the database, if the error carries one. */
export function toErrorCode(error: unknown): ErrorCode | null {
  const e = asErrorLike(error);
  const haystacks = [
    typeof error === 'string' ? error : '',
    str(e?.message),
    str(e?.details),
    str(e?.code),
  ];
  for (const text of haystacks) {
    if (!text) continue;
    if ((KNOWN_CODES as string[]).includes(text.trim())) return text.trim() as ErrorCode;
    for (const code of KNOWN_CODES) {
      if (new RegExp(`(^|[^a-z_])${code}([^a-z_]|$)`).test(text)) return code;
    }
  }
  return null;
}

const AUTH_CODES = new Set([
  'session_expired',
  'session_not_found',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'bad_jwt',
  'no_authorization',
  'user_not_found',
  'PGRST301',
  'PGRST303',
]);

function isNetworkError(error: unknown): boolean {
  const e = asErrorLike(error);
  if (e?.status === 0) return true;
  const name = str(e?.name);
  if (name === 'AuthRetryableFetchError') return true;
  const text = `${name} ${str(e?.message)}`;
  if (error instanceof TypeError || name === 'TypeError') {
    return /failed to fetch|load failed|network|fetch failed/i.test(text);
  }
  return /failed to fetch|networkerror|network request failed|load failed/i.test(text);
}

/** Turns anything thrown or returned by Supabase/PostgREST into a message safe to show the user. */
export function toUserMessage(error: unknown): string {
  const code = toErrorCode(error);
  if (code) return ERROR_MESSAGES[code];

  const e = asErrorLike(error);
  if (isNetworkError(error)) return MESSAGE_NETWORK;
  if (AUTH_CODES.has(str(e?.code)) || e?.status === 401) return MESSAGE_LOGIN_AGAIN;
  // 42501 = insufficient_privilege: a row-level security policy refused the write
  // (also what a suspended account hits).
  if (str(e?.code) === '42501' || e?.status === 403) return MESSAGE_NO_PERMISSION;
  return MESSAGE_FALLBACK;
}

/** True when the error is not a known, expected failure: send details to Sentry. */
export function isUnexpectedError(error: unknown): boolean {
  return toUserMessage(error) === MESSAGE_FALLBACK;
}
