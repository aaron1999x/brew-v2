// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicEnv, getServerEnv, resetEnvCacheForTests } from '@/lib/env';

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_dummy',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  NEXT_PUBLIC_APP_ENV: 'local',
  NEXT_PUBLIC_SENTRY_DSN: '',
  SUPABASE_SECRET_KEY: 'sb_secret_dummy',
  SENTRY_AUTH_TOKEN: '',
};

function setEnv(overrides: Record<string, string | undefined> = {}) {
  for (const [k, v] of Object.entries({ ...valid, ...overrides })) {
    if (v === undefined) vi.stubEnv(k, undefined as unknown as string);
    else vi.stubEnv(k, v);
  }
}

describe('env', () => {
  beforeEach(() => resetEnvCacheForTests());
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCacheForTests();
  });

  it('accepts valid public env; blank optional values become undefined', () => {
    setEnv();
    const env = getPublicEnv();
    expect(env.NEXT_PUBLIC_APP_ENV).toBe('local');
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
  });

  it('rejects a legacy-looking key as the publishable key', () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiJ9.legacy.jwt' });
    expect(() => getPublicEnv()).toThrow(/sb_publishable_/);
  });

  it('rejects an unknown environment name and names the variable', () => {
    setEnv({ NEXT_PUBLIC_APP_ENV: 'prod' });
    expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_APP_ENV/);
  });

  it('gives a clear error when a variable is missing', () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined });
    expect(() => getPublicEnv()).toThrow(
      /Invalid public environment variables[\s\S]*NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it('requires the secret key to start with sb_secret_', () => {
    setEnv({ SUPABASE_SECRET_KEY: 'sb_publishable_oops' });
    expect(() => getServerEnv()).toThrow(/sb_secret_/);
  });

  it('accepts a valid secret key', () => {
    setEnv();
    expect(getServerEnv().SUPABASE_SECRET_KEY).toBe('sb_secret_dummy');
  });
});
