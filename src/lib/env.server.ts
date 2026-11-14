import { z } from 'zod';
import { optional, parse } from '@/lib/env';

/**
 * Server-only environment (the secret key). Kept out of `env.ts` on purpose: that file is
 * imported by browser code, and this schema must never be bundled for the browser. Only
 * `lib/supabase/admin.ts` (which imports `server-only`) uses it.
 */
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_', 'must be a secret key (sb_secret_…)'),
  SENTRY_AUTH_TOKEN: optional(z.string()),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let serverEnv: ServerEnv | undefined;

/** Server-only env (secret key). Throws if called in the browser. */
export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv() must not be called in the browser.');
  }
  serverEnv ??= parse(
    serverSchema,
    {
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    },
    'server',
  );
  return serverEnv;
}

/** Test helper: forget the cached value. */
export function resetServerEnvCacheForTests(): void {
  serverEnv = undefined;
}
