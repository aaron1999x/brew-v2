// Locks a recipe version on STAGING by seeding one brew that references it (for manual checks of
// "this version has brews"). The database locks a version when its first brew is saved.
//
//   node scripts/seed-brew.mjs --handle <handle> --slug <recipe-slug> --version <n>
//   node scripts/seed-brew.mjs --remove <brew-id>
//
// THE LOCK IS PERMANENT. Removing the brew does not unlock the version: the database's lock guard
// refuses every change to a locked version's `locked_at`, for the secret key too. So use this on a
// throwaway recipe (duplicate one, check the copy, delete the copy), never on a recipe you keep.
// Never prints keys or URLs.
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertStaging } from './assert-staging.mjs';

assertStaging();
const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const staging = (env.STAGING_PROJECT_REF ?? '').trim();
const production = (env.PRODUCTION_PROJECT_REF ?? '').trim();
if (!url || !staging || !url.includes(staging) || (production && url.includes(production))) {
  console.error('seed-brew: NEXT_PUBLIC_SUPABASE_URL is not the staging project. Refusing.');
  process.exit(1);
}
if (!env.SUPABASE_SECRET_KEY) {
  console.error('seed-brew: SUPABASE_SECRET_KEY is missing (set it in .env.local).');
  process.exit(1);
}

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function usage(message) {
  console.error(`seed-brew: ${message}`);
  console.error('  node scripts/seed-brew.mjs --handle <handle> --slug <recipe-slug> --version <n>');
  console.error('  node scripts/seed-brew.mjs --remove <brew-id>');
  process.exit(1);
}

const admin = createClient(url, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const removeId = option('remove');
if (removeId) {
  const { error } = await admin.from('brews').delete().eq('id', removeId);
  if (error) usage(`could not remove the brew: ${error.message}`);
  console.log(`Removed brew ${removeId}. The version stays locked.`);
  process.exit(0);
}

const handle = option('handle')?.replace(/^@/, '').toLowerCase();
const slug = option('slug');
const versionNo = Number(option('version'));
if (!handle || !slug || !Number.isInteger(versionNo) || versionNo < 1) {
  usage('--handle, --slug and a whole --version number are required.');
}

const profile = await admin.from('profiles').select('id').eq('handle', handle).maybeSingle();
if (profile.error || !profile.data) usage(`no user with the handle "${handle}".`);
const recipe = await admin
  .from('recipes')
  .select('id, name')
  .eq('owner_id', profile.data.id)
  .eq('slug', slug)
  .is('deleted_at', null)
  .maybeSingle();
if (recipe.error || !recipe.data) usage(`@${handle} has no recipe with the slug "${slug}".`);
const version = await admin
  .from('recipe_versions')
  .select('id, locked_at')
  .eq('recipe_id', recipe.data.id)
  .eq('version_no', versionNo)
  .maybeSingle();
if (version.error || !version.data) usage(`"${recipe.data.name}" has no v${versionNo}.`);

const id = randomUUID();
const inserted = await admin.from('brews').insert({
  id,
  user_id: profile.data.id,
  recipe_version_id: version.data.id,
  brewed_at: new Date().toISOString(),
  overall: 8,
});
if (inserted.error) usage(`could not seed the brew: ${inserted.error.message}`);

const after = await admin
  .from('recipe_versions')
  .select('locked_at')
  .eq('id', version.data.id)
  .single();
console.log(
  `Seeded brew ${id}: "${recipe.data.name}" v${versionNo} is now ${after.data?.locked_at ? 'locked' : 'NOT locked (unexpected)'}.`,
);
console.log(`Remove the brew with: node scripts/seed-brew.mjs --remove ${id}`);
console.log('The version stays locked either way.');
