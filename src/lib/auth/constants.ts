export const MIN_PASSWORD_LENGTH = 8;

/** Short-lived cookie set after a recovery link is verified; /reset-password needs it. */
export const RECOVERY_COOKIE = 'recovery_ok';
export const RECOVERY_COOKIE_PATH = '/reset-password';
export const RECOVERY_COOKIE_MAX_AGE_S = 15 * 60;

/**
 * Token-hash `type` values in our email links. Per the Supabase SSR docs the confirm-signup
 * template uses `email` (older links used `signup`; both verify the same way) and the
 * reset-password template uses `recovery`. The templates, /auth/confirm and verifyOtp agree.
 */
export const CONFIRM_TYPES = ['email', 'signup', 'recovery'] as const;
export type ConfirmType = (typeof CONFIRM_TYPES)[number];

export function isConfirmType(value: string | null | undefined): value is ConfirmType {
  return typeof value === 'string' && (CONFIRM_TYPES as readonly string[]).includes(value);
}

/** `?notice=<key>` after a redirect → toast text (never text taken from the URL itself). */
export const FLASH_NOTICES = {
  'password-changed': 'Password changed.',
  'signed-out': 'Logged out.',
} as const;
export type FlashNotice = keyof typeof FLASH_NOTICES;
