import { expectNoAxeViolations } from './helpers/axe';
import { createRecipe } from './helpers/recipes';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

// "Vary temperature by pour" sits in the Numbers section, under the numbers grid with its hint, as
// in the prototype's Parameters card (it used to be at the top of Steps). Metric units (en-GB).
test.use({ serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London' });

test('the switch is under the numbers grid, says what every pour uses, and fills in the pours', async ({
  page,
  users,
}) => {
  const user = await signIn(page, users, 'vary-temp');
  const recipe = await createRecipe(users, user);
  await page.goto(`/@${user.handle}/${recipe.slug}/edit?v=1`);
  await waitForApp(page);

  const temperature = page.getByLabel('Water temperature');
  const vary = page.getByRole('switch', { name: 'Vary temperature by pour' });
  const grind = page.getByLabel('Grind setting');
  await expect(vary).not.toBeChecked();
  await expect(page.getByText('Every pour uses 93 °C')).toBeVisible();

  // Under the whole grid (after Water temperature and Grind setting); nothing about it left at the top of Steps.
  const [t, v, g] = await Promise.all([
    temperature.boundingBox(),
    vary.locator('xpath=ancestor::label').boundingBox(),
    grind.boundingBox(),
  ]);
  expect(v!.y).toBeGreaterThan(t!.y);
  expect(v!.y).toBeGreaterThan(g!.y);
  await expect(page.getByRole('switch', { name: 'Vary temperature by pour' })).toHaveCount(1);

  // Off: pours have no temperature field.
  await expect(page.getByRole('group', { name: /^Step 3,/ }).getByLabel('Temperature (optional)')).toHaveCount(0);

  // On: every pour starts at 93 °C, with a Temperature field of its own.
  await vary.locator('xpath=ancestor::label').click();
  await expect(vary).toBeChecked();
  const pour2 = page.getByRole('group', { name: /^Step 3,/ }).getByLabel('Temperature (optional)');
  await expect(pour2).toHaveValue('93');
  await expect(page.getByText('Each pour sets its own temperature in Steps · 93 °C')).toBeVisible();

  await pour2.fill('95');
  await pour2.blur();
  await expect(page.getByText('Each pour sets its own temperature in Steps · 93 °C → 95 °C → 93 °C')).toBeVisible();
  await expectNoAxeViolations(page);

  // Off again: the per-pour temperatures go, and the hint is back.
  await vary.locator('xpath=ancestor::label').click();
  await expect(vary).not.toBeChecked();
  await expect(page.getByText('Every pour uses 93 °C')).toBeVisible();
  await expect(page.getByRole('group', { name: /^Step 3,/ }).getByLabel('Temperature (optional)')).toHaveCount(0);
});

test('the hint follows the temperature, in the person’s units', async ({ page, users }) => {
  const user = await signIn(page, users, 'vary-temp-hint');
  const recipe = await createRecipe(users, user);
  await page.goto(`/@${user.handle}/${recipe.slug}/edit?v=1`);
  await waitForApp(page);
  const temperature = page.getByLabel('Water temperature');
  await temperature.fill('92');
  await temperature.blur();
  await expect(page.getByText('Every pour uses 92 °C')).toBeVisible();
});
