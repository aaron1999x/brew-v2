import * as Sentry from '@sentry/nextjs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

// Sends one test error to Sentry so the release/environment tags can be checked in production:
//   https://<host>/api/sentry-test?key=<SENTRY_TEST_KEY>
//   (or: curl -H "Authorization: Bearer <SENTRY_TEST_KEY>" https://<host>/api/sentry-test)
// SENTRY_TEST_KEY is optional. If it is unset, or the key is wrong, the route is a plain 404.
// DELETE THIS ROUTE (and SENTRY_TEST_KEY) once the production Sentry check has passed.
export const dynamic = 'force-dynamic';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function authorised(request: Request): boolean {
  const expected = process.env.SENTRY_TEST_KEY;
  if (!expected) return false;
  const url = new URL(request.url);
  const given =
    url.searchParams.get('key') ??
    (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  // Compare fixed-length hashes in constant time, so neither content nor length leaks.
  return timingSafeEqual(digest(given), digest(expected));
}

export async function GET(request: Request) {
  if (!authorised(request)) return new NextResponse(null, { status: 404 });
  const eventId = Sentry.captureException(new Error('Sentry test error (api/sentry-test)'));
  await Sentry.flush(2000);
  return NextResponse.json(
    {
      sent: true,
      eventId,
      release: `app@${process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'}`,
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'local',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
