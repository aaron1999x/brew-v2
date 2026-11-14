import * as Sentry from '@sentry/nextjs';
import { isUnexpectedError } from '@/lib/errors/messages';

/**
 * Sends an error to Sentry when it isn't one of the expected, user-fixable failures
 * (see `isUnexpectedError`). Pass `force` for cases the caller already knows are unexpected.
 * `context` must not contain emails, passwords or other personal data.
 */
export function reportUnexpected(
  error: unknown,
  context?: Record<string, string>,
  force = false,
): void {
  if (!force && !isUnexpectedError(error)) return;
  Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
    extra: context,
  });
}
