import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { isValidTestKey, readTestKey } from '@/lib/sentry/test-key';

// Sends one test error to Sentry so the release/environment tags can be checked in production:
//   curl -H "Authorization: Bearer <SENTRY_TEST_KEY>" https://<host>/api/sentry-test
//   https://<host>/api/sentry-test?key=<SENTRY_TEST_KEY>   (for a phone browser; the URL gets logged)
// SENTRY_TEST_KEY is optional. If it is unset, or the key is wrong, the route is a plain 404.
// DELETE THIS ROUTE (and SENTRY_TEST_KEY) once the production Sentry check has passed.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isValidTestKey(readTestKey(request), process.env.SENTRY_TEST_KEY)) {
    return new NextResponse(null, { status: 404 });
  }
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
