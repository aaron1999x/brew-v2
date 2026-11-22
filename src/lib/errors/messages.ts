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
  version_not_found: "This recipe version isn't available any more.",
  brew_not_found: "This brew isn't available any more.",
  quick_change_invalid: "This change can't be saved. Check grind, temperature, dose and water.",
  brew_conflict: "This brew couldn't be saved. Try again.",
  overall_required: 'Score the cup overall before saving',
  handle_reserved: "That handle isn't available. Try another.",
  handle_recently_used: "That handle isn't available. Try another.",
  moderator_only: "You don't have permission to do that.",
  admin_only: "You don't have permission to do that.",
  immutable_field: "That can't be changed.",
  brew_version_immutable: "A brew can't be moved to another recipe version.",
  cannot_suspend_self: "You can't suspend your own account.",
  not_authenticated: 'Please log in again.',
  invite_only: 'Sign-ups are invite-only right now.',
  invite_used: "That person has already signed up, so the invite can't be removed.",
  email_invalid: 'Enter a valid email address.',
  handle_taken: 'That handle is taken. Try another.',
  handle_invalid: 'Use 3–30 lowercase letters, numbers or underscores.',
  gear_not_found: 'That gear item no longer exists.',
  steps_invalid: "Some steps aren't valid. Check the highlighted steps.",
} as const;

const BREW_SCORE_MESSAGE = 'Scores go from 0 to 10 in steps of 0.5.';

/**
 * Named check / unique constraints (Postgres 23514 / 23505) → plain messages. Matched by the
 * constraint name in the error message. Constraints come from migrations …_m3_gear_recipes.sql and
 * …_m4_brews.sql (and the Phase 1 gear default index and brews columns). The forms validate first,
 * so these are a safety net.
 */
export const CONSTRAINT_MESSAGES: Record<string, string> = {
  recipe_versions_steps_shape: ERROR_MESSAGES.steps_invalid,
  recipe_versions_steps_schema: ERROR_MESSAGES.steps_invalid,
  recipe_versions_bypass_consistent: 'Choose when the bypass water goes in, or set bypass to 0.',
  recipe_versions_drawdown_range: "The shortest drawdown can't be longer than the longest.",
  recipe_versions_tds_range: "The lowest TDS can't be higher than the highest.",
  recipe_versions_ey_range: "The lowest extraction can't be higher than the highest.",
  recipes_method_custom_required: 'Name the method when you choose Other.',
  gear_one_default_per_category: 'You already have a default for this category. Try again.',
  brews_flavours_valid: 'Use up to 12 flavour tags of 30 characters or fewer, each added once.',
  brews_brewed_at_not_future: "The brew time can't be in the future.",
  brews_tds_pct_check: 'TDS is between 0 and 20%.',
  brews_beverage_g_check: 'That beverage weight is out of range.',
  brews_drawdown_s_check: 'Drawdown can be up to 2 hours.',
  brews_tasted_after_min_check: 'Minutes after brewing: 0 to 240.',
  brews_notes_check: 'Notes can be up to 5,000 characters.',
  brews_next_change_check: 'This note can be up to 1,000 characters.',
  brews_sweetness_check: BREW_SCORE_MESSAGE,
  brews_acidity_check: BREW_SCORE_MESSAGE,
  brews_brightness_check: BREW_SCORE_MESSAGE,
  brews_body_check: BREW_SCORE_MESSAGE,
  brews_clarity_check: BREW_SCORE_MESSAGE,
  brews_balance_check: BREW_SCORE_MESSAGE,
  brews_aftertaste_check: BREW_SCORE_MESSAGE,
  brews_overall_check: BREW_SCORE_MESSAGE,
};

/** The constraint named in a check or unique violation, if it's one we translate. */
export function toConstraintName(error: unknown): string | null {
  const e = asErrorLike(error);
  const text = `${typeof error === 'string' ? error : ''} ${str(e?.message)} ${str(e?.details)}`;
  const match = /violates (?:check|unique) constraint "([a-z0-9_]+)"/.exec(text);
  const name = match?.[1];
  return name && Object.hasOwn(CONSTRAINT_MESSAGES, name) ? name : null;
}

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export const MESSAGE_LOGIN_AGAIN = 'Please log in again.';
export const MESSAGE_NO_PERMISSION = "You don't have permission to do that.";
export const MESSAGE_NETWORK = "Couldn't reach the server. Check your connection and try again.";
export const MESSAGE_FALLBACK = 'Something went wrong. Try again.';

/**
 * Supabase Auth `error.code` values (not message text) → plain messages.
 * Codes come from @supabase/auth-js ErrorCode.
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email or password is wrong.',
  email_not_confirmed: 'Confirm your email first.',
  over_request_rate_limit: 'Too many attempts. Wait a minute and try again.',
  over_email_send_rate_limit: 'Too many attempts. Wait a minute and try again.',
  weak_password: 'Choose a password with at least 8 characters.',
  same_password: 'Choose a different password from your current one.',
  reauthentication_not_valid: 'Your current password is wrong.',
  current_password_invalid: 'Your current password is wrong.',
  current_password_required: 'Enter your current password.',
  otp_expired: 'This link has expired or was already used.',
  flow_state_expired: 'This link has expired or was already used.',
  flow_state_not_found: 'This link has expired or was already used.',
};
export const MESSAGE_LINK_EXPIRED = 'This link has expired or was already used.';
export const MESSAGE_RATE_LIMITED = 'Too many attempts. Wait a minute and try again.';

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
  const constraint = toConstraintName(error);
  if (constraint) return CONSTRAINT_MESSAGES[constraint]!;

  const e = asErrorLike(error);
  if (isNetworkError(error)) return MESSAGE_NETWORK;
  const authCode = str(e?.code);
  const authMessage = Object.hasOwn(AUTH_ERROR_MESSAGES, authCode)
    ? AUTH_ERROR_MESSAGES[authCode]
    : undefined;
  if (authMessage) return authMessage;
  if (e?.status === 429) return MESSAGE_RATE_LIMITED;
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
