import type { ErrorEvent } from '@sentry/nextjs';

/** Remove anything personal before an event leaves the app. Pure, unit-tested. */
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
  }
  return event;
}

/**
 * Options shared by the client, server and edge SDK. Each NEXT_PUBLIC_ variable is read by its
 * literal name so Next.js inlines it into the client bundle.
 */
export function sentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
  return {
    dsn,
    enabled: Boolean(dsn),
    release: `app@${version}`,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'local',
    sendDefaultPii: false,
    // Errors only: no performance tracing, to stay inside the free tier.
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  };
}
