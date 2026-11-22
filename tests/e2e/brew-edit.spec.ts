import { expectNoAxeViolations } from './helpers/axe';
import { logBrewRpc } from './helpers/brews';
import { createRecipe } from './helpers/recipes';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

// Edit brew is the log's own page, layout and fields, with only the version locked. Needs the
// staging secret key (skips without it). Metric units (en-GB).
test.use({ serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London' });

const SUMMARY = '[aria-labelledby="form-error-summary-title"]';

test('edit uses the same wide cards and fields as the log, with Drawdown for a pour-over', async ({
  page,
  users,
}) => {
  const user = await signIn(page, users, 'edit-layout');
  // A pour-over without a drawdown target and a brew with no drawdown logged: the method alone asks for it.
  const recipe = await createRecipe(users, user, 'Morning V60', {
    version: {
      drawdown_min_s: null,
      drawdown_max_s: null,
      tds_min: 1.3,
      tds_max: 1.5,
      ey_min: 19,
      ey_max: 21,
    },
  });
  const id = await logBrewRpc(users, user, recipe.v1Id, {
    drawdown_s: null,
    beverage_g: 212,
    tds_pct: 1.4,
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/brews/${id}/edit`);
  await waitForApp(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Edit brew' })).toBeVisible();

  // The same cards in the same rows, as wide as the log.
  const card = (name: string) => page.getByRole('region', { name, exact: true });
  const [setup, results, sensory, flavour, notes] = await Promise.all(
    ['Setup', 'Results', 'Sensory', 'Flavour notes', 'Notes'].map(
      async (n) => (await card(n).boundingBox())!,
    ),
  );
  expect(Math.round(setup!.y)).toBe(Math.round(results!.y));
  expect(Math.round(setup!.y + setup!.height)).toBe(Math.round(results!.y + results!.height));
  expect(sensory!.width).toBeGreaterThan(1000);
  expect(Math.round(flavour!.y)).toBe(Math.round(notes!.y));
  expect(results!.x).toBeGreaterThan(setup!.x + setup!.width - 2);
  await expect(page.locator('[data-page-width]').first()).toHaveAttribute(
    'data-page-width',
    'wide',
  );

  // Drawdown is there (the method rule), next to the other result inputs; the three tiles share a row.
  await expect(page.getByLabel('Drawdown')).toBeVisible();
  await expect(page.getByLabel('Beverage weight')).toHaveValue(/212/);
  const tiles = await page
    .getByLabel('Extraction', { exact: true })
    .locator('> div')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(tiles).toHaveLength(3);
  expect(new Set(tiles).size).toBe(1);

  // Only the version is locked: said in words, not editable.
  await expect(page.getByText('The recipe version this brew used can’t be changed.')).toBeVisible();
  await expect(page.getByRole('radio', { name: /version/i })).toHaveCount(0);
  expect(
    (await page.getByRole('img', { name: /^Taste\./ }).boundingBox())!.width,
  ).toBeGreaterThanOrEqual(320);
  await expectNoAxeViolations(page);

  // A drawdown typed here is saved.
  await page.getByLabel('Drawdown').fill('2:52');
  await page.getByLabel('Drawdown').blur();
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await page.waitForURL(`**/brews/${id}`);
  const { data } = await users.admin
    .from('brews')
    .select('drawdown_s, recipe_version_id')
    .eq('id', id)
    .single();
  expect(data?.drawdown_s).toBe(172);
  expect(data?.recipe_version_id).toBe(recipe.v1Id);
});

test('edit keeps the overall required and shows the same error summary', async ({
  page,
  users,
}) => {
  const user = await signIn(page, users, 'edit-errors');
  const recipe = await createRecipe(users, user);
  const id = await logBrewRpc(users, user, recipe.v1Id);
  await page.goto(`/brews/${id}/edit`);
  await waitForApp(page);
  await page.getByLabel('TDS (%)').fill('abc');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.locator(SUMMARY)).toBeFocused();
  await expect(page.locator(SUMMARY).getByRole('link')).toHaveText(['Use a number, e.g. 1.38']);
});
