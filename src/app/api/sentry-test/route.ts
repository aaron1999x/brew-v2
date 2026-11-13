import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

// Sends one test error to Sentry so the release/environment tags can be checked in production.
//   curl -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" https://<host>/api/sentry-test
// Requires SENTRY_AUTH_TOKEN to be set on the server; anyone without it gets a plain 404.
export const dynamic = 'force-dynamic';

function authorised(request: Request): boolean {
  const expected = process.env.SENTRY_AUTH_TOKEN;
  if (!expected) return false;
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorised(request)) return new NextResponse(null, { status: 404 });
  const eventId = Sentry.captureException(new Error('Sentry test error (api/sentry-test)'));
  await Sentry.flush(2000);
  return NextResponse.json({
    sent: true,
    eventId,
    release: `app@${process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'}`,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'local',
  });
}
