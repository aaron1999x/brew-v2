import { describe, expect, it } from 'vitest';
import { checkStaging } from '../../scripts/assert-staging.mjs';

const STAGING = 'stagingref12345678901';
const PROD = 'prodref1234567890123';
const base = {
  STAGING_PROJECT_REF: STAGING,
  PRODUCTION_PROJECT_REF: PROD,
  STAGING_DB_URL: `postgresql://postgres.${STAGING}:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
};

describe('assert-staging', () => {
  it('allows the staging project', () => {
    expect(checkStaging(base).ok).toBe(true);
  });
  it('blocks when STAGING_PROJECT_REF is missing', () => {
    expect(checkStaging({ ...base, STAGING_PROJECT_REF: '' }).ok).toBe(false);
  });
  it('blocks when PRODUCTION_PROJECT_REF is missing (guard cannot work)', () => {
    expect(checkStaging({ ...base, PRODUCTION_PROJECT_REF: '' }).ok).toBe(false);
  });
  it('blocks when staging ref equals production ref', () => {
    expect(checkStaging({ ...base, STAGING_PROJECT_REF: PROD }).ok).toBe(false);
  });
  it('blocks when the db url contains the production ref', () => {
    const url = `postgresql://postgres.${PROD}:pw@host:5432/postgres`;
    expect(checkStaging({ ...base, STAGING_DB_URL: url }).ok).toBe(false);
    expect(checkStaging(base, { dbUrl: url }).ok).toBe(false);
  });
  it('blocks a db url that does not contain the staging ref', () => {
    expect(
      checkStaging({ ...base, STAGING_DB_URL: 'postgresql://x:y@somewhere.example:5432/db' }).ok,
    ).toBe(false);
  });
  it('blocks when the public Supabase URL points at production', () => {
    expect(
      checkStaging({ ...base, NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co` }).ok,
    ).toBe(false);
  });
  it('SKIP_ASSERT_STAGING allows only loopback urls', () => {
    const env = { SKIP_ASSERT_STAGING: '1' };
    expect(
      checkStaging(env, { dbUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' }).ok,
    ).toBe(true);
    expect(
      checkStaging(env, { dbUrl: 'postgresql://postgres:postgres@localhost:5432/postgres' }).ok,
    ).toBe(true);
    expect(checkStaging(env, { dbUrl: base.STAGING_DB_URL }).ok).toBe(false);
    expect(
      checkStaging(env, { dbUrl: `postgresql://u:p@db.${PROD}.supabase.co/postgres` }).ok,
    ).toBe(false);
    expect(checkStaging(env, {}).ok).toBe(false);
  });
});
