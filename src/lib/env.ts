import { z } from 'zod';

/** Empty strings (blank lines in .env files) count as "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .startsWith('sb_publishable_', 'must be a publishable key (sb_publishable_…)'),
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_APP_ENV: z.enum(['local', 'staging', 'production']),
  NEXT_PUBLIC_SENTRY_DSN: optional(z.url()),
});

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_', 'must be a secret key (sb_secret_…)'),
  SENTRY_AUTH_TOKEN: optional(z.string()),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function parse<T extends z.ZodType>(
  schema: T,
  raw: Record<string, unknown>,
  label: string,
): z.infer<T> {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const lines = result.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
  throw new Error(
    `Invalid ${label} environment variables. Check .env.local (see .env.example):\n${lines.join('\n')}`,
  );
}

let publicEnv: PublicEnv | undefined;
let serverEnv: ServerEnv | undefined;

/**
 * Public env, safe in the browser. Each variable is read by its literal name so Next.js can inline
 * it into the client bundle (dynamic `process.env[name]` lookups are not inlined).
 */
export function getPublicEnv(): PublicEnv {
  publicEnv ??= parse(
    publicSchema,
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    },
    'public',
  );
  return publicEnv;
}

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

/** Test helper: forget cached values. */
export function resetEnvCacheForTests(): void {
  publicEnv = undefined;
  serverEnv = undefined;
}
