// assert-staging -> supabase link (staging) -> supabase db push --remote (staging).
// Supabase CLI 3.x: `db push` targets the local database unless --remote is given,
// and hosted changes need --yes. The DB password is passed via SUPABASE_DB_PASSWORD, never argv.
import { spawnSync } from 'node:child_process';
import { assertStaging } from './assert-staging.mjs';

// The CLI dev dependency's entry point, run with this Node (no shell, so no argument concatenation).
const SUPABASE_CLI = 'node_modules/supabase/dist/supabase.js';

assertStaging();
const ref = process.env.STAGING_PROJECT_REF;
const password = decodeURIComponent(new URL(process.env.STAGING_DB_URL).password);
if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error('db-push: SUPABASE_ACCESS_TOKEN is missing (set it in .env.local).');
  process.exit(1);
}

const env = { ...process.env, SUPABASE_DB_PASSWORD: password };
const run = (args) => {
  console.log(`> supabase ${args.join(' ')}`);
  const r = spawnSync(process.execPath, [SUPABASE_CLI, ...args], { stdio: 'inherit', env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Push through the session pooler (IPv4). The direct db host is IPv6-only, which many networks lack.
// The password is stripped from the URL and passed via PGPASSWORD so it never appears in argv or logs.
const pooler = new URL(process.env.STAGING_DB_URL);
pooler.password = '';
env.PGPASSWORD = password;

run(['link', '--project-ref', ref]);
run(['db', 'push', `--remote=${pooler.toString()}`, '--yes', ...process.argv.slice(2)]);
