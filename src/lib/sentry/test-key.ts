import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/**
 * Checks the key sent to /api/sentry-test against SENTRY_TEST_KEY. Fails closed: an unset or
 * empty expected key never matches. Compares fixed-length SHA-256 digests with timingSafeEqual,
 * so neither the content nor the length of the key leaks through timing.
 */
export function isValidTestKey(
  given: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || !given) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

/** Reads the key from `?key=` or an `Authorization: Bearer` header (the header is safer: URLs get logged). */
export function readTestKey(request: Request): string | null {
  const fromQuery = new URL(request.url).searchParams.get('key');
  if (fromQuery) return fromQuery;
  const header = request.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}
