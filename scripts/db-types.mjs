// assert-staging -> supabase gen types (staging, public schema) -> src/types/database.ts
// Generated from the staging session-pooler connection (IPv4; no Docker or extra token scope needed).
// The password goes through PGPASSWORD, never argv or logs.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as prettier from 'prettier';
import { assertStaging } from './assert-staging.mjs';

const SUPABASE_CLI = 'node_modules/supabase/dist/supabase.js';
const OUT = 'src/types/database.ts';

assertStaging();
const url = new URL(process.env.STAGING_DB_URL);
const password = decodeURIComponent(url.password);
url.password = '';

const r = spawnSync(
  process.execPath,
  [SUPABASE_CLI, 'gen', 'types', 'typescript', `--remote=${url.toString()}`, '--schema', 'public'],
  {
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: password },
    maxBuffer: 32 * 1024 * 1024,
  },
);
if (r.status !== 0 || !r.stdout.includes('export type Database')) {
  console.error((r.stderr || r.stdout || 'db-types: no output').replaceAll(password, '***'));
  process.exit(r.status || 1);
}

const config = (await prettier.resolveConfig(OUT)) ?? {};
const formatted = await prettier.format(r.stdout, { ...config, filepath: OUT });
mkdirSync('src/types', { recursive: true });
writeFileSync(OUT, formatted);
console.log(`db-types: wrote ${OUT}`);
