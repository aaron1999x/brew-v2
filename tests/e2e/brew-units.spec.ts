import { stubDevice, openPrep } from './helpers/brew-device';
import { logBrewRpc } from './helpers/brews';
import { createRecipe } from './helpers/recipes';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

// °F and oz across the timer, the log, the brew detail and compare: every shown value converts, and
// what is stored never changes (a field never writes back a converted value that wasn't edited).
// Needs the staging secret key (skips without it).
test.use({ serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London' });

test.beforeEach(async ({ page }) => {
  await stubDevice(page);
});

const IMPERIAL = { temp_unit: 'f', weight_unit: 'oz' } as const;
const METRIC = { temp_unit: 'c', weight_unit: 'g' } as const;
/** Weight in grams written as "212 g" or "7.5 g": a metric weight left on screen. */
const GRAMS = /\d\s?g\b/;

test('every shown value converts in the timer, log, detail and compare, and stored values never drift', async ({
  page,
  users,
}) => {
  test.slow();
  const user = await signIn(page, users, 'brew-units');
  // 15 g dose, 250 g water, 93 °C, three pours: 0.53 oz, 8.82 oz and 199.4 °F.
  const recipe = await createRecipe(users, user, 'Morning V60', {
    version: { tds_min: 1.3, tds_max: 1.5, ey_min: 19, ey_max: 21 },
  });
  const a = await logBrewRpc(users, user, recipe.v1Id, { beverage_g: 212, tds_pct: 1.4 });
  const b = await logBrewRpc(users, user, recipe.v1Id, {
    beverage_g: 200,
    tds_pct: 1.3,
    overall: 7,
    brewed_at: new Date(Date.now() - 7_200_000).toISOString(),
  });
  await users.admin.from('user_settings').update(IMPERIAL).eq('user_id', user.id);

  // The timer's prep screen: weights in ounces, the temperature in °F.
  await openPrep(page, user, recipe.slug);
  await expect(page.getByText('0.53 oz').first()).toBeVisible();
  await expect(page.getByText('8.82 oz').first()).toBeVisible();
  await expect(page.getByText('199.4 °F').first()).toBeVisible();
  await expect(page.locator('main')).not.toContainText(GRAMS);

  // The log: its weight field is in ounces and the tiles and notes follow.
  await page.goto(`/@${user.handle}/${recipe.slug}?brew=1`);
  await waitForApp(page);
  await page
    .getByRole('dialog', { name: 'Brew this recipe' })
    .getByRole('button', { name: 'Log only' })
    .click();
  await page.waitForURL('**/brews/new?session=*');
  await expect(page.getByRole('img', { name: /^Taste\./ })).toBeVisible();
  await expect(page.getByLabel('Beverage weight')).toBeVisible();
  await expect(page.locator('main')).not.toContainText(GRAMS);

  // The detail: dose, water and beverage weight in ounces.
  await page.goto(`/brews/${a}`);
  await waitForApp(page);
  await expect(page.getByRole('img', { name: /^Taste\./ })).toBeVisible();
  const setup = page.getByRole('region', { name: 'Setup', exact: true });
  await expect(setup).toContainText('0.53 oz');
  await expect(setup).toContainText('8.82 oz');
  await expect(page.getByRole('region', { name: 'Results', exact: true })).toContainText('7.48 oz');
  await expect(page.locator('main')).not.toContainText(GRAMS);

  // The edit: the beverage field shows ounces. Saving a change to the notes alone must not rewrite the
  // weight with a rounded conversion of itself.
  await page.goto(`/brews/${a}/edit`);
  await waitForApp(page);
  await expect(page.getByLabel('Beverage weight')).toHaveValue('7.48');
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Only the notes changed');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await page.waitForURL(`**/brews/${a}`);
  const stored = await users.admin
    .from('brews')
    .select('beverage_g, tds_pct, notes')
    .eq('id', a)
    .single();
  expect(stored.data).toMatchObject({
    beverage_g: 212,
    tds_pct: 1.4,
    notes: 'Only the notes changed',
  });

  // Compare: weights in ounces, the temperature in °F, in the table and the stacked list.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/brews/compare?ids=${a},${b}`);
  await waitForApp(page);
  await expect(page.getByRole('img', { name: /^Taste, compared\./ })).toBeVisible();
  const table = page.getByRole('table');
  const cell = (label: string) =>
    table
      .getByRole('row')
      .filter({ has: page.getByRole('rowheader', { name: new RegExp(`^${label}`) }) });
  await expect(cell('Dose')).toContainText('0.53 oz');
  await expect(cell('Brew water')).toContainText('8.82 oz');
  await expect(cell('Temperature')).toContainText('199.4 °F');
  await expect(cell('Beverage weight')).toContainText('7.48 oz');
  await expect(cell('Beverage weight')).toContainText('7.05 oz');
  await expect(page.locator('main')).not.toContainText(GRAMS);

  // Nothing stored changed in any of it.
  const rows = await users.admin
    .from('brews')
    .select('id, beverage_g, dose_g_snapshot')
    .in('id', [a, b]);
  const byId = new Map((rows.data ?? []).map((r) => [r.id as string, r]));
  expect(byId.get(a)).toMatchObject({ beverage_g: 212, dose_g_snapshot: 15 });
  expect(byId.get(b)).toMatchObject({ beverage_g: 200, dose_g_snapshot: 15 });
  const version = await users.admin
    .from('recipe_versions')
    .select('dose_g, brew_water_g, temp_c')
    .eq('id', recipe.v1Id)
    .single();
  expect(version.data).toMatchObject({ dose_g: 15, brew_water_g: 250, temp_c: 93 });

  // Back to metric: the values are exactly as saved.
  await users.admin.from('user_settings').update(METRIC).eq('user_id', user.id);
  await page.goto(`/brews/${a}`);
  await waitForApp(page);
  await expect(page.getByRole('region', { name: 'Setup', exact: true })).toContainText('15 g');
  await expect(page.getByRole('region', { name: 'Results', exact: true })).toContainText('212 g');
});
