// End-to-end check of account deletion on STAGING, outside any transaction.
//
//   npm run verify:account-delete
//
// Creates two throwaway confirmed users (@test.invalid, allowlisted first, no emails sent),
// user A publishes a recipe, has gear (one a favourite), and has recipes with several versions
// (one archived, one soft-deleted); user B brews A's recipe, copies it, and has gear and a recipe
// of their own (real API calls, committed). Then it deletes A with auth.admin.deleteUser (the same
// call the delete-account route uses) and checks that A's rows are gone, the favourite-gear trigger
// didn't stop the cascade, and B's brew, copy, gear and recipe survive (the credit cleared).
// Everything it creates is deleted in `finally`, and it then checks no test users remain.
// Never prints keys, passwords or URLs.
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertStaging } from './assert-staging.mjs';

assertStaging();
const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const staging = (env.STAGING_PROJECT_REF ?? '').trim();
const production = (env.PRODUCTION_PROJECT_REF ?? '').trim();
if (!url || !staging || !url.includes(staging) || (production && url.includes(production))) {
  console.error(
    'verify-account-delete: NEXT_PUBLIC_SUPABASE_URL is not the staging project. Refusing.',
  );
  process.exit(1);
}
for (const key of ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY']) {
  if (!env[key]) {
    console.error(`verify-account-delete: ${key} is missing (set it in .env.local).`);
    process.exit(1);
  }
}

const TEST_DOMAIN = '@test.invalid';
const noSession = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, env.SUPABASE_SECRET_KEY, noSession);

const runId = randomBytes(4).toString('hex');
const users = {
  a: { email: `verify-del-a-${runId}${TEST_DOMAIN}`, handle: `vd_a_${runId}` },
  b: { email: `verify-del-b-${runId}${TEST_DOMAIN}`, handle: `vd_b_${runId}` },
};
for (const u of Object.values(users)) u.password = randomBytes(18).toString('base64url');

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? ` (${detail})` : ''}`);
  if (!ok) failures += 1;
}
function must({ data, error }, step) {
  if (error) throw new Error(`${step}: ${error.code ?? ''} ${error.message}`);
  return data;
}
async function countRows(table, column, value) {
  const { count, error } = await admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, value);
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count;
}
async function signIn(u) {
  const client = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, noSession);
  must(
    await client.auth.signInWithPassword({ email: u.email, password: u.password }),
    `sign in ${u.handle}`,
  );
  return client;
}

let aDeleted = false;
try {
  // 1–2. Allowlist, then create confirmed users (no email is sent by createUser).
  must(
    await admin
      .from('signup_allowlist')
      .insert(Object.values(users).map((u) => ({ email: u.email }))),
    'allowlist',
  );
  for (const u of Object.values(users)) {
    const data = must(
      await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { handle: u.handle, display_name: u.handle, time_zone: 'UTC' },
      }),
      `create ${u.handle}`,
    );
    u.id = data.user.id;
  }
  console.log('Created two confirmed test users.');

  // 3. A: public recipe with v1.
  const a = await signIn(users.a);
  const recipe = must(
    await a.rpc('create_recipe', {
      p_name: `Verify delete ${runId}`,
      p_method: 'pour_over',
      p_method_custom: null,
      p_version: { dose_g: 18, brew_water_g: 300 },
    }),
    'create_recipe',
  );
  must(await a.from('recipes').update({ visibility: 'public' }).eq('id', recipe.id), 'publish');
  const v1 = recipe.latest_version_id;

  // 3b. A: gear (one default, one favourite), a recipe with three versions, an archived recipe and a
  // soft-deleted one. Deleting A must remove all of it without the favourite-gear trigger interfering.
  const aGear = must(
    await a
      .from('gear_items')
      .insert([
        { user_id: users.a.id, category: 'grinder', custom_name: 'Verify grinder', nickname: 'Faithful', is_default: true },
        { user_id: users.a.id, category: 'brewer', custom_name: 'Verify brewer', nickname: null, is_default: false },
      ])
      .select('id, category'),
    'A gear',
  );
  const aGrinder = aGear.find((g) => g.category === 'grinder');
  must(
    await a
      .from('profiles')
      .update({ favourite_gear: [{ item_id: aGrinder.id, category: 'grinder', name: 'Verify grinder' }] })
      .eq('id', users.a.id),
    'A favourites',
  );
  const multi = must(
    await a.rpc('create_recipe', {
      p_name: `Verify versions ${runId}`,
      p_method: 'pour_over',
      p_method_custom: null,
      p_version: { dose_g: 15, brew_water_g: 250, steps_schema: 1, steps: [] },
    }),
    'create multi-version recipe',
  );
  for (const note of ['finer', 'cooler']) {
    must(
      await a.rpc('save_recipe', {
        p_recipe_id: multi.id,
        p_name: multi.name,
        p_method: 'pour_over',
        p_method_custom: null,
        p_base_version_id: multi.latest_version_id,
        p_version: { dose_g: 15, brew_water_g: 250, steps_schema: 1, steps: [], change_note: note },
        p_as_new_version: true,
      }),
      `save_recipe (${note})`,
    );
  }
  const archivedRecipe = must(
    await a.rpc('create_recipe', {
      p_name: `Verify archived ${runId}`,
      p_method: 'aeropress',
      p_method_custom: null,
      p_version: { dose_g: 15, brew_water_g: 220 },
    }),
    'create archived recipe',
  );
  must(
    await a.from('recipes').update({ archived_at: new Date().toISOString() }).eq('id', archivedRecipe.id),
    'archive',
  );
  const deletedRecipe = must(
    await a.rpc('create_recipe', {
      p_name: `Verify deleted ${runId}`,
      p_method: 'french_press',
      p_method_custom: null,
      p_version: { dose_g: 30, brew_water_g: 500 },
    }),
    'create deleted recipe',
  );
  must(
    await a.from('recipes').update({ deleted_at: new Date().toISOString() }).eq('id', deletedRecipe.id),
    'soft delete',
  );
  const aRecipeIds = [recipe.id, multi.id, archivedRecipe.id, deletedRecipe.id];

  // 4. B: brew on A's v1 and a copy of it.
  const b = await signIn(users.b);
  const brewId = randomUUID();
  must(
    await b.from('brews').insert({
      id: brewId,
      user_id: users.b.id,
      recipe_version_id: v1,
      brewed_at: new Date().toISOString(),
      overall: 6,
    }),
    'brew',
  );
  const copy = must(await b.rpc('copy_recipe', { p_version_id: v1 }), 'copy_recipe');
  // B's own gear and a recipe with two versions: untouched by A's deletion.
  must(
    await b.from('gear_items').insert({ user_id: users.b.id, category: 'kettle', custom_name: 'B kettle', is_default: true }),
    'B gear',
  );
  const bRecipe = must(
    await b.rpc('create_recipe', {
      p_name: `Verify B own ${runId}`,
      p_method: 'pour_over',
      p_method_custom: null,
      p_version: { dose_g: 16, brew_water_g: 260, steps_schema: 1, steps: [] },
    }),
    'B recipe',
  );
  must(
    await b.rpc('save_recipe', {
      p_recipe_id: bRecipe.id,
      p_name: bRecipe.name,
      p_method: 'pour_over',
      p_method_custom: null,
      p_base_version_id: bRecipe.latest_version_id,
      p_version: { dose_g: 16, brew_water_g: 260, steps_schema: 1, steps: [], change_note: 'v2' },
      p_as_new_version: true,
    }),
    'B v2',
  );
  console.log(
    'A published a recipe, has gear, a favourite and recipes with several versions; B brewed, copied, and has gear and a recipe of their own.',
  );

  // 5. Delete A exactly like the delete-account route will.
  const del = await admin.auth.admin.deleteUser(users.a.id);
  check('auth.admin.deleteUser(A) succeeds', !del.error, del.error?.message);
  aDeleted = !del.error;

  // 6. Checks (secret key: bypasses RLS).
  const gone = await admin.auth.admin.getUserById(users.a.id);
  check('A no longer exists in auth.users', !!gone.error || !gone.data?.user);
  for (const [table, column] of [
    ['profiles', 'id'],
    ['user_settings', 'user_id'],
    ['account_status', 'user_id'],
    ['recipes', 'owner_id'],
    ['brews', 'user_id'],
    ['notifications', 'user_id'],
    ['handle_history', 'user_id'],
    ['gear_items', 'user_id'],
  ]) {
    check(`A's ${table} rows are gone`, (await countRows(table, column, users.a.id)) === 0);
  }
  check(
    "A's recipe versions are gone",
    (await countRows('recipe_versions', 'recipe_id', recipe.id)) === 0,
  );
  for (const [label, id] of [
    ['the three-version recipe', multi.id],
    ['the archived recipe', archivedRecipe.id],
    ['the soft-deleted recipe', deletedRecipe.id],
  ]) {
    check(`A's ${label} and its versions are gone`, (await countRows('recipes', 'id', id)) === 0 && (await countRows('recipe_versions', 'recipe_id', id)) === 0);
  }
  check("none of A's four recipes is left", (await countRows('recipes', 'owner_id', users.a.id)) === 0 && aRecipeIds.length === 4);
  check(
    "B's gear, own recipe and both its versions survive",
    (await countRows('gear_items', 'user_id', users.b.id)) === 1 &&
      (await countRows('recipes', 'id', bRecipe.id)) === 1 &&
      (await countRows('recipe_versions', 'recipe_id', bRecipe.id)) === 2,
  );

  const brew = must(
    await admin.from('brews').select('*').eq('id', brewId).maybeSingle(),
    'read brew',
  );
  check("B's brew still exists", !!brew);
  check(
    "B's brew recipe_version_id and recipe_id are null",
    brew?.recipe_version_id === null && brew?.recipe_id === null,
  );
  check(
    "B's brew keeps its snapshots",
    brew?.recipe_name_snapshot === `Verify delete ${runId}` &&
      brew?.author_handle_snapshot === users.a.handle &&
      brew?.version_no_snapshot === 1 &&
      Number(brew?.dose_g_snapshot) === 18,
  );

  const c = must(
    await admin.from('recipes').select('*').eq('id', copy.id).maybeSingle(),
    'read copy',
  );
  check("B's copy still exists", !!c && c.is_copy === true);
  check(
    "B's copy has forked_from_version_id and forked_from_owner_id null",
    c?.forked_from_version_id === null && c?.forked_from_owner_id === null,
  );
  check(
    "B's copy keeps its own v1",
    (await countRows('recipe_versions', 'recipe_id', copy.id)) === 1,
  );
} catch (error) {
  failures += 1;
  console.log(`FAIL  ${error instanceof Error ? error.message : String(error)}`);
} finally {
  // 7. Cleanup: always.
  for (const u of [users.b, ...(aDeleted ? [] : [users.a])]) {
    if (!u.id) continue;
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) console.log(`WARN  could not delete ${u.handle}: ${error.message}`);
  }
  await admin
    .from('signup_allowlist')
    .delete()
    .in(
      'email',
      Object.values(users).map((u) => u.email),
    );

  const leftovers = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      leftovers.push(`listUsers failed: ${error.message}`);
      break;
    }
    leftovers.push(...data.users.filter((u) => u.email?.endsWith(TEST_DOMAIN)).map((u) => u.email));
    if (data.users.length < 1000) break;
  }
  const { count } = await admin
    .from('signup_allowlist')
    .select('*', { count: 'exact', head: true })
    .like('email', `%${TEST_DOMAIN}`);
  check('no test users left on staging', leftovers.length === 0, leftovers.join(', '));
  check('no test allowlist rows left on staging', count === 0, `${count} rows`);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
