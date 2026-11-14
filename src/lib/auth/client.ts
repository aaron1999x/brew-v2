'use client';

import { getPublicEnv } from '@/lib/env';
import { authConfirmUrl, type OriginConfig } from '@/lib/auth/redirect';

export const RESEND_COOLDOWN_SECONDS = 60;
export { MIN_PASSWORD_LENGTH } from '@/lib/auth/constants';

export function getOriginConfig(): OriginConfig {
  const env = getPublicEnv();
  return { appEnv: env.NEXT_PUBLIC_APP_ENV, siteUrl: env.NEXT_PUBLIC_SITE_URL };
}

/** `<current origin>/auth/confirm` when that origin is allowed, else the site URL's. */
export function currentConfirmUrl(): string {
  return authConfirmUrl(window.location.origin, getOriginConfig());
}

/**
 * Supabase hides trigger failures behind a generic error. The caller must NOT assume it means
 * "invite-only": it asks `can_sign_up` again and only then decides.
 */
export function isSignupDatabaseError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'unexpected_failure' ||
    (error.message ?? '').includes('Database error saving new user')
  );
}

const STORAGE_KEY = 'pending-signup';
export type PendingSignup = { email: string; sentAt: number };

/** Remembers who we sent the confirmation email to (this tab only). */
export function savePendingSignup(value: PendingSignup): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be blocked; the check-email screen then asks for no address.
  }
}

/** The stored value as a string (a stable snapshot for useSyncExternalStore). */
export function readPendingSignupRaw(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function parsePendingSignup(raw: string | null): PendingSignup | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingSignup>;
    if (typeof parsed.email !== 'string' || typeof parsed.sentAt !== 'number') return null;
    return { email: parsed.email, sentAt: parsed.sentAt };
  } catch {
    return null;
  }
}

export function clearPendingSignup(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Seconds left of the resend cooldown (0 = can resend). */
export function cooldownRemaining(sentAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - (now - sentAt) / 1000));
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s.]+$/;
export function isPlausibleEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
