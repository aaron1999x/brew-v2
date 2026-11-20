import { baseVersion, createRecipe, saveNextVersion } from './helpers/recipes';
import { expect, signIn, test, type TestUser, type TestUsers } from './helpers/test-users';

// Uses the staging secret key from the runner's environment and skips without it.
test.use({ serviceWorkers: 'block' });

async function addGear(users: TestUsers, user: TestUser, name: string, nickname: string) {
  const { error } = await users.admin.from('gear_items').insert({
    user_id: user.id,
    category: 'grinder',
    custom_name: name,
    nickname,
    is_default: true,
  });
  expect(error).toBeNull();
}

test.describe('Download my data', () => {
  test('includes my gear, recipes and every version with real data, and nothing of anyone else’s', async ({
    page,
    users,
  }) => {
    // Someone else, with gear and a recipe of their own.
    const other = await users.create('export-other');
    await addGear(users, other, 'Other person’s grinder', 'Their nickname');
    const theirs = await createRecipe(users, other, 'Their secret brew');

    const me = await signIn(page, users, 'export-me');
    await addGear(users, me, 'My hand grinder', 'Old faithful');
    const mine = await createRecipe(users, me, 'Morning V60');
    await saveNextVersion(users, me, mine, baseVersion({ temp_c: 92, change_note: 'cooler' }));

    const response = await page.request.get('/api/export');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toMatch(/brew-data-\d{4}-\d{2}-\d{2}\.json/);
    const text = await response.text();
    const data = JSON.parse(text);

    // Gear: my item, with its real name, nickname and default flag.
    expect(data.gear).toHaveLength(1);
    expect(data.gear[0]).toMatchObject({
      custom_name: 'My hand grinder',
      nickname: 'Old faithful',
      is_default: true,
      category: 'grinder',
    });

    // Recipes: mine, each with all its versions and their full contents.
    expect(data.recipes).toHaveLength(1);
    const recipe = data.recipes[0];
    expect(recipe).toMatchObject({ name: 'Morning V60', slug: mine.slug, visibility: 'private' });
    expect(recipe.versions.map((v: { version_no: number }) => v.version_no)).toEqual([1, 2]);
    expect(recipe.versions[0]).toMatchObject({
      dose_g: 15,
      brew_water_g: 250,
      temp_c: 93,
      grind_setting: '24 clicks',
      gear: { brewer: { name: 'Hario V60 02' } },
    });
    expect(recipe.versions[0].steps).toHaveLength(4);
    expect(recipe.versions[0].steps[2]).toMatchObject({ kind: 'pour', at_s: 45, target_g: 150 });
    expect(recipe.versions[1]).toMatchObject({ temp_c: 92, change_note: 'cooler' });

    // Nothing of the other person's: not their gear, recipe, versions, or ids.
    for (const secret of [
      'Their secret brew',
      'Other person’s grinder',
      'Their nickname',
      theirs.id,
      theirs.v1Id,
      other.id,
      other.email,
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  test('a soft-deleted recipe is still my data, and an empty account exports empty lists', async ({
    page,
    users,
  }) => {
    const me = await signIn(page, users, 'export-empty');
    const empty = await (await page.request.get('/api/export')).json();
    expect(empty.gear).toEqual([]);
    expect(empty.recipes).toEqual([]);

    const mine = await createRecipe(users, me, 'Deleted one');
    await users.admin.from('recipes').update({ deleted_at: new Date().toISOString() }).eq('id', mine.id);
    const after = await (await page.request.get('/api/export')).json();
    expect(after.recipes.map((r: { name: string }) => r.name)).toEqual(['Deleted one']);
    expect(after.recipes[0].versions).toHaveLength(1);
  });
});
