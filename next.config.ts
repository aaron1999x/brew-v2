import { withSerwist } from '@serwist/turbopack';
import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
import pkg from './package.json' with { type: 'json' };

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
  },
};

const hasSentryToken = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(withSerwist(nextConfig), {
  // Source maps are uploaded only when an auth token is present (Vercel builds), never locally.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sourcemaps: { disable: !hasSentryToken },
  release: { name: `app@${pkg.version}` },
  telemetry: false,
  silent: !process.env.CI,
});
