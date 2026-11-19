import { expect } from '@playwright/test';
import type { TestUser, TestUsers } from './test-users';

/** The numbers every spec's recipe starts with: a V60 with three pours and a swirl. */
export function baseVersion(over: Record<string, unknown> = {}) {
  return {
    dose_g: 15,
    brew_water_g: 250,
    temp_c: 93,
    grind_setting: '24 clicks',
    bypass_g: 0,
    bypass_timing: 'none',
    steps_schema: 1,
    drawdown_min_s: 165,
    drawdown_max_s: 195,
    steps: [
      { id: 'p1', kind: 'pour', at_s: 0, target_g: 30 },
      { id: 's1', kind: 'swirl', at_s: 10, duration_s: 5 },
      { id: 'p2', kind: 'pour', at_s: 45, target_g: 150 },
      { id: 'p3', kind: 'pour', at_s: 90, target_g: 250 },
    ],
    gear: { brewer: { name: 'Hario V60 02' } },
    ...over,
  };
}

/** A saved recipe (v1) for `user`, made the way the app makes one: as that member, so RLS applies. */
export async function createRecipe(
  users: TestUsers,
  user: Pick<TestUser, 'email' | 'password'>,
  name = 'Morning V60',
) {
  const client = await users.clientFor(user);
  const { data, error } = await client.rpc('create_recipe', {
    p_name: name,
    p_method: 'pour_over',
    p_method_custom: null,
    p_version: baseVersion(),
  });
  expect(error).toBeNull();
  const recipe = data as { id: string; slug: string };
  const { data: v1 } = await users.admin
    .from('recipe_versions')
    .select('id')
    .eq('recipe_id', recipe.id)
    .eq('version_no', 1)
    .single();
  return { id: recipe.id, slug: recipe.slug, v1Id: v1!.id as string };
}

/** Saves the next version as the member (what the editor's "Save as vN" does). */
export async function saveNextVersion(
  users: TestUsers,
  user: Pick<TestUser, 'email' | 'password'>,
  recipe: { id: string; v1Id: string },
  version: Record<string, unknown>,
  name = 'Morning V60',
) {
  const client = await users.clientFor(user);
  const { data, error } = await client.rpc('save_recipe', {
    p_recipe_id: recipe.id,
    p_name: name,
    p_method: 'pour_over',
    p_method_custom: null,
    p_base_version_id: recipe.v1Id,
    p_version: version,
    p_as_new_version: true,
  });
  expect(error).toBeNull();
  return data as { id: string; version_no: number };
}

/**
 * Locks a version the way the app does: a brew that references it (the database does the locking).
 * Seeded with the secret key and removed with the test user; `removeBrew` is for specs that want it
 * gone before the end.
 */
export async function seedBrew(users: TestUsers, userId: string, versionId: string) {
  const id = crypto.randomUUID();
  const { error } = await users.admin.from('brews').insert({
    id,
    user_id: userId,
    recipe_version_id: versionId,
    brewed_at: new Date().toISOString(),
    overall: 8,
  });
  expect(error).toBeNull();
  const { data } = await users.admin
    .from('recipe_versions')
    .select('locked_at')
    .eq('id', versionId)
    .single();
  expect(data?.locked_at).not.toBeNull();
  return { id, removeBrew: () => users.admin.from('brews').delete().eq('id', id) };
}

export async function versionRows(users: TestUsers, recipeId: string) {
  const { data, error } = await users.admin
    .from('recipe_versions')
    .select('id, version_no, dose_g, temp_c, grind_setting, notes, change_note, locked_at')
    .eq('recipe_id', recipeId)
    .order('version_no');
  expect(error).toBeNull();
  return data!;
}
