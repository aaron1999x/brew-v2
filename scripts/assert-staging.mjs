// Safety guard: every script that talks to a database calls assertStaging() first.
// It refuses to run against production. Run directly (`node scripts/assert-staging.mjs`) to self-check.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

/** Pure check, unit-tested. Returns { ok, message }. */
export function checkStaging(env, { dbUrl } = {}) {
  const fail = (message) => ({ ok: false, message: `assert-staging: ${message}` });
  const staging = (env.STAGING_PROJECT_REF ?? '').trim();
  const production = (env.PRODUCTION_PROJECT_REF ?? '').trim();
  const target = dbUrl ?? env.STAGING_DB_URL ?? '';

  // CI throwaway database: only a loopback URL is allowed, only when explicitly flagged.
  if (env.SKIP_ASSERT_STAGING === '1') {
    let host;
    try {
      host = new URL(target).hostname;
    } catch {
      return fail(
        'SKIP_ASSERT_STAGING=1 needs a valid --db-url pointing at 127.0.0.1 or localhost.',
      );
    }
    if (!LOCAL_HOSTS.has(host)) {
      return fail(`SKIP_ASSERT_STAGING=1 only allows 127.0.0.1/localhost, got host "${host}".`);
    }
    return { ok: true, message: 'assert-staging: local throwaway database allowed.' };
  }

  if (!staging) return fail('STAGING_PROJECT_REF is missing (set it in .env.local).');
  if (!production) {
    return fail('PRODUCTION_PROJECT_REF is missing; it is required so production can be blocked.');
  }
  if (staging === production)
    return fail('STAGING_PROJECT_REF equals PRODUCTION_PROJECT_REF. Refusing.');
  if (!target) return fail('STAGING_DB_URL is missing (set it in .env.local).');
  if (target.includes(production))
    return fail('the database URL contains the PRODUCTION project ref. Refusing.');
  if (!target.includes(staging)) {
    return fail(
      'the database URL does not contain STAGING_PROJECT_REF, so it may not be the staging database. Refusing.',
    );
  }
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL']) {
    if (env[key] && env[key].includes(production)) {
      return fail(`${key} contains the PRODUCTION project ref. Refusing.`);
    }
  }
  return { ok: true, message: 'assert-staging: target is the staging project.' };
}

/** Loads .env.local (without overriding real env vars), checks, exits 1 on failure. */
export function assertStaging({ dbUrl } = {}) {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  const result = checkStaging(process.env, { dbUrl });
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(assertStaging().message);
}
