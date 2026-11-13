// Runs every supabase/tests/NN_*.sql file with psql (each wraps itself in begin … rollback),
// collects the pgTAP output and fails on "not ok", a plan mismatch, or any psql error.
// Afterwards checks that no test users (@test.invalid) remain.
//
//   npm run db:test                      -> staging (STAGING_DB_URL from .env.local)
//   node scripts/db-test.mjs --db-url …  -> another database (CI: SKIP_ASSERT_STAGING=1 + 127.0.0.1)
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { assertStaging } from './assert-staging.mjs';

const TEST_DIR = 'supabase/tests';
const TEST_EMAIL_DOMAIN = '@test.invalid';

const argIndex = process.argv.indexOf('--db-url');
const cliUrl = argIndex > -1 ? process.argv[argIndex + 1] : undefined;
if (argIndex > -1 && !cliUrl) {
  console.error('db-test: --db-url needs a value');
  process.exit(1);
}

assertStaging({ dbUrl: cliUrl });
const dbUrl = cliUrl ?? process.env.STAGING_DB_URL;
const scrub = (s) =>
  (s ?? '').replaceAll(dbUrl, '<db-url>').replace(/:\/\/([^:@/]+):[^@/]+@/g, '://$1:***@');

function psql(args) {
  return spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t', ...args], {
    encoding: 'utf8',
    env: { ...process.env, PGCLIENTENCODING: 'UTF8' },
    maxBuffer: 16 * 1024 * 1024,
  });
}

/** Parses pgTAP output. Exported shape kept simple for the summary. */
function parseTap(output) {
  const lines = output.split(/\r?\n/).map((l) => l.trim());
  const planLine = lines.find((l) => /^1\.\.\d+$/.test(l));
  const planned = planLine ? Number(planLine.slice(3)) : null;
  const passed = lines.filter((l) => /^ok \d+/.test(l));
  const failed = lines.filter((l) => /^not ok \d+/.test(l));
  const diagnostics = lines.filter((l) => l.startsWith('#'));
  return { planned, passed: passed.length, failed, diagnostics };
}

const files = readdirSync(TEST_DIR)
  .filter((f) => /^\d\d_.*\.sql$/.test(f) && f !== '00_helpers.sql')
  .sort();
if (files.length === 0) {
  console.error(`db-test: no test files in ${TEST_DIR}`);
  process.exit(1);
}

let ok = true;
const summary = [];
for (const file of files) {
  const r = psql(['-f', join(TEST_DIR, file)]);
  const tap = parseTap(r.stdout ?? '');
  const ran = tap.passed + tap.failed.length;
  const problems = [];
  if (r.status !== 0) problems.push(`psql exited with ${r.status}`);
  if (tap.planned === null) problems.push('no plan found');
  else if (ran !== tap.planned) problems.push(`planned ${tap.planned}, ran ${ran}`);
  if (tap.failed.length) problems.push(`${tap.failed.length} failed`);

  summary.push(`${problems.length ? 'FAIL' : 'ok  '} ${file}  ${tap.passed}/${tap.planned ?? '?'}`);
  if (problems.length) {
    ok = false;
    console.error(`\n--- ${file}: ${problems.join('; ')}`);
    for (const l of tap.failed) console.error(`  ${l}`);
    for (const l of tap.diagnostics.slice(0, 30)) console.error(`  ${l}`);
    const stderr = scrub(r.stderr).trim();
    if (stderr)
      console.error(
        stderr
          .split('\n')
          .slice(-15)
          .map((l) => `  ${l}`)
          .join('\n'),
      );
  }
}

// Nothing may be left behind: every file rolls back, so test users must be gone.
const left = psql([
  '-c',
  `select (select count(*) from auth.users where email like '%${TEST_EMAIL_DOMAIN}')
        + (select count(*) from public.signup_allowlist where email like '%${TEST_EMAIL_DOMAIN}')`,
]);
const leftover = Number((left.stdout ?? '').trim());
if (left.status !== 0 || Number.isNaN(leftover)) {
  ok = false;
  summary.push('FAIL leftover check could not run');
  console.error(scrub(left.stderr));
} else if (leftover !== 0) {
  ok = false;
  summary.push(`FAIL ${leftover} test user/allowlist row(s) left behind`);
} else {
  summary.push('ok   no test users or allowlist rows left behind');
}

console.log(`\ndb-test summary\n${summary.join('\n')}`);
process.exit(ok ? 0 : 1);
