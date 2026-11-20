import { baseVersion, createRecipe, saveNextVersion, versionRows } from './helpers/recipes';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

// Uses the staging secret key from the runner's environment and skips without it. Service workers
// are blocked: nothing here needs one.
test.use({ serviceWorkers: 'block' });

test.describe('°F and oz across recipes', () => {
  test('the editor, recipe page and compare convert for display, and stored values never drift', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'recipe-units');
    const recipe = await createRecipe(users, user);
    await saveNextVersion(users, user, recipe, baseVersion({ temp_c: 92 }));
    const imperial = { temp_unit: 'f', weight_unit: 'oz' };
    await users.admin.from('user_settings').update(imperial).eq('user_id', user.id);
    const base = `/@${user.handle}/${recipe.slug}`;

    // Recipe page: key numbers and every pour in ounces, the temperature in °F.
    await page.goto(base);
    const key = page.getByLabel('Key numbers');
    await expect(key).toContainText('0.53 oz');
    await expect(key).toContainText('8.82 oz');
    await expect(key).toContainText('197.6 °F');
    const steps = page.getByRole('region', { name: 'Steps' });
    await expect(steps).toContainText('1.06 oz');
    await expect(steps).toContainText('5.29 oz');
    await expect(page.locator('main')).not.toContainText(/\d\s?g\b/);

    // Compare: old and new, converted.
    await page.goto(`${base}/compare?a=1&b=2`);
    const changed = page.locator('[data-changed="numbers.temp_c"]');
    await expect(changed).toContainText('199.4 °F');
    await expect(changed).toContainText('197.6 °F');

    // The editor shows converted values in its fields.
    await page.goto(`${base}/edit?v=1`);
    await waitForApp(page);
    await expect(page.getByLabel('Coffee dose')).toHaveValue('0.53');
    await expect(page.getByLabel('Brew water')).toHaveValue('8.82');
    await expect(page.getByLabel('Water temperature')).toHaveValue('199.4');
    await expect(page.getByRole('group', { name: /^Step 1,/ }).getByLabel(/Scale reads after pouring/)).toHaveValue('1.06');

    // Change only the notes and save: nothing numeric was edited, so nothing numeric is written back.
    await page.getByLabel('Notes (optional)').fill('Only the notes changed');
    await expect(page.getByTestId('change-summary')).toHaveText('1 field changed');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForURL(`**${base}/v/1`);
    await expect(page.getByText('v1 updated')).toBeVisible();

    const [v1] = await versionRows(users, recipe.id);
    expect(v1).toMatchObject({ dose_g: 15, temp_c: 93, notes: 'Only the notes changed' });
    const { data: stored } = await users.admin
      .from('recipe_versions')
      .select('dose_g, brew_water_g, temp_c, drawdown_min_s, drawdown_max_s, steps')
      .eq('id', recipe.v1Id)
      .single();
    const original = baseVersion();
    expect(stored).toEqual({
      dose_g: 15,
      brew_water_g: 250,
      temp_c: 93,
      drawdown_min_s: 165,
      drawdown_max_s: 195,
      steps: original.steps,
    });

    // Back to metric: everything reads exactly as it was saved.
    await users.admin
      .from('user_settings')
      .update({ temp_unit: 'c', weight_unit: 'g' })
      .eq('user_id', user.id);
    await page.goto(`${base}/v/1`);
    await expect(page.getByLabel('Key numbers')).toContainText('15 g');
    await expect(page.getByLabel('Key numbers')).toContainText('250 g');
    await expect(page.getByLabel('Key numbers')).toContainText('93 °C');
  });

  test('typing a value in ounces stores the grams it means', async ({ page, users }) => {
    const user = await signIn(page, users, 'recipe-units-typed');
    await users.admin
      .from('user_settings')
      .update({ temp_unit: 'f', weight_unit: 'oz' })
      .eq('user_id', user.id);
    await page.goto('/recipes/new');
    await waitForApp(page);
    const dose = page.getByLabel('Coffee dose');
    await dose.fill('0.5');
    await dose.blur();
    const water = page.getByLabel('Brew water');
    await water.fill('8');
    await water.blur();
    const temp = page.getByLabel('Water temperature');
    await temp.fill('200');
    await temp.blur();
    await page.getByLabel('Name').fill('Ounces recipe');
    await page.getByRole('button', { name: /Method$/ }).click();
    await page.getByRole('option', { name: 'Pour-over', exact: true }).click();
    await page.getByRole('button', { name: 'Save recipe' }).click();
    await page.waitForURL(`**/@${user.handle}/ounces-recipe`);

    const { data: recipe } = await users.admin
      .from('recipes')
      .select('id')
      .eq('owner_id', user.id)
      .single();
    const [v1] = await versionRows(users, recipe!.id);
    // 0.5 oz = 14.17 g (kept to 0.1 g), 8 oz = 226.8 g, 200 °F = 93.3 °C.
    expect(v1).toMatchObject({ dose_g: 14.2, temp_c: 93.3 });
    const { data: saved } = await users.admin
      .from('recipe_versions')
      .select('brew_water_g')
      .eq('recipe_id', recipe!.id)
      .single();
    expect(saved!.brew_water_g).toBe(226.8);
  });
});
