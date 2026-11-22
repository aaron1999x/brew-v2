import { expectNoAxeViolations } from './helpers/axe';
import { openPrep, stubDevice } from './helpers/brew-device';
import { createRecipe } from './helpers/recipes';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

// The grind setting is free text ("7.5", "2.5.0", "24 clicks"): a plain text input of up to 40
// characters, with no numeric keypad, no auto-capitalising and no auto-correct, in the recipe editor
// and in "Change for this brew". Particle size (µm) is the whole-number field: it sits under "More
// options" with Retention, never refuses a keystroke, and says what is wrong when you save.
test.use({ serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London' });

const INPUTS = ['7.5', '2.5.0', '24 clicks', '7,5'];
const SUMMARY = '[aria-labelledby="form-error-summary-title"]';

test('the recipe editor’s grind setting is first in its row, with a placeholder and a hint', async ({
  page,
  users,
}) => {
  const user = await signIn(page, users, 'grind-editor');
  const recipe = await createRecipe(users, user);
  await page.goto(`/@${user.handle}/${recipe.slug}/edit?v=1`);
  await waitForApp(page);

  const field = page.getByLabel('Grind setting', { exact: true });
  await expect(field).toHaveAttribute('type', 'text');
  await expect(field).toHaveAttribute('inputmode', 'text');
  await expect(field).toHaveAttribute('maxlength', '40');
  await expect(field).toHaveAttribute('autocapitalize', 'none');
  await expect(field).toHaveAttribute('autocorrect', 'off');
  await expect(field).toHaveAttribute('placeholder', 'e.g. 7.5 or 24 clicks');
  await expect(page.getByText('As shown on your grinder')).toBeVisible();

  // Before Water hardness: first in its row. Particle size is not among the main fields.
  const [grind, water] = await Promise.all([
    field.boundingBox(),
    page.getByLabel('Water hardness (ppm)').boundingBox(),
  ]);
  expect(grind!.y).toBeLessThanOrEqual(water!.y + 1);
  if (Math.abs(grind!.y - water!.y) <= 1) expect(grind!.x).toBeLessThan(water!.x);
  await expect(page.getByLabel('Particle size (µm)')).toBeHidden();

  for (const text of INPUTS) {
    await field.fill('');
    await field.pressSequentially(text);
    await expect(field).toHaveValue(text);
    await field.blur();
    await expect(field).toHaveValue(text);
  }

  // Saved exactly as typed.
  await field.fill('');
  await field.pressSequentially('7.5');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await page.waitForURL((url) => !url.pathname.endsWith('/edit'));
  const { data } = await users.admin
    .from('recipe_versions')
    .select('grind_setting, grind_microns')
    .eq('id', recipe.v1Id)
    .single();
  expect(data?.grind_setting).toBe('7.5');
  expect(data?.grind_microns).toBeNull();
});

test('Particle size is under More options with Retention, and never refuses a key', async ({ page, users }) => {
  const user = await signIn(page, users, 'particle-fields');
  const recipe = await createRecipe(users, user);
  await page.goto(`/@${user.handle}/${recipe.slug}/edit?v=1`);
  await waitForApp(page);

  const more = page.getByRole('button', { name: 'More options' });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('Particle size (µm)')).toBeHidden();
  await expect(page.getByLabel('Retention (g water per g coffee)')).toBeHidden();
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');

  const size = page.getByLabel('Particle size (µm)');
  await expect(size).toBeVisible();
  await expect(page.getByLabel('Retention (g water per g coffee)')).toBeVisible();
  await expect(page.getByText('Optional. Whole microns, e.g. 750')).toBeVisible();
  await expect(size).toHaveAttribute('type', 'text');
  // The decimal keypad: a point can be typed, and the message explains it when saving.
  await expect(size).toHaveAttribute('inputmode', 'decimal');

  // Every key is accepted and kept as typed, in every number field of the editor.
  for (const text of ['7.5', '750', 'abc', '7,5', '1.2.3']) {
    await size.fill('');
    await size.pressSequentially(text);
    await expect(size).toHaveValue(text);
  }
  const altitude = page.getByLabel('Altitude (metres)');
  await altitude.fill('');
  await altitude.pressSequentially('18.5m');
  await expect(altitude).toHaveValue('18.5m');
  await expectNoAxeViolations(page);
});

test('typing 7.5 into Particle size shows the error and saves nothing; fixing it saves', async ({
  page,
  users,
}) => {
  const user = await signIn(page, users, 'particle-error');
  const recipe = await createRecipe(users, user);
  await page.goto(`/@${user.handle}/${recipe.slug}/edit?v=1`);
  await waitForApp(page);

  await page.getByRole('button', { name: 'More options' }).click();
  const size = page.getByLabel('Particle size (µm)');
  await size.pressSequentially('7.5');
  await expect(size).toHaveValue('7.5');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();

  // The error summary takes focus and says what to do; the field says it too. Nothing is saved.
  const summary = page.locator(SUMMARY);
  await expect(page.getByRole('heading', { name: 'Fix 1 thing to continue' })).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary.getByRole('link')).toHaveText(['Use whole microns, e.g. 750']);
  await expect(size).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Use whole microns, e.g. 750')).toHaveCount(2); // summary and field
  await expect(page).toHaveURL(/\/edit/);
  const before = await users.admin
    .from('recipe_versions')
    .select('grind_microns, grind_setting')
    .eq('id', recipe.v1Id)
    .single();
  expect(before.data?.grind_microns).toBeNull();
  expect(before.data?.grind_setting).toBe('24 clicks');
  const count = await users.admin
    .from('recipe_versions')
    .select('id', { count: 'exact', head: true })
    .eq('recipe_id', recipe.id);
  expect(count.count).toBe(1);

  // Text that isn't a number gets the same message.
  await size.fill('');
  await size.pressSequentially('abc');
  await expect(summary.getByRole('link')).toHaveText(['Use whole microns, e.g. 750']);
  await expectNoAxeViolations(page);

  // The link in the summary goes to the field.
  await summary.getByRole('link', { name: 'Use whole microns, e.g. 750' }).click();
  await expect(size).toBeFocused();

  // Fixed: whole microns save.
  await size.fill('');
  await size.pressSequentially('750');
  // The field's own message clears at once (the summary at the top stays until the next save).
  await expect(size).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Use whole microns, e.g. 750')).toHaveCount(1);
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await page.waitForURL((url) => !url.pathname.endsWith('/edit'));
  const after = await users.admin
    .from('recipe_versions')
    .select('grind_microns')
    .eq('id', recipe.v1Id)
    .single();
  expect(after.data?.grind_microns).toBe(750);
});

test('More options opens by itself when a field inside has an error', async ({ page, users }) => {
  const user = await signIn(page, users, 'particle-opens');
  const recipe = await createRecipe(users, user);
  await page.goto(`/@${user.handle}/${recipe.slug}/edit?v=1`);
  await waitForApp(page);

  const more = page.getByRole('button', { name: 'More options' });
  await more.click();
  await page.getByLabel('Particle size (µm)').pressSequentially('7.5');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'false');

  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.locator(SUMMARY)).toBeFocused();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await page.locator(SUMMARY).getByRole('link', { name: 'Use whole microns, e.g. 750' }).click();
  await expect(page.getByLabel('Particle size (µm)')).toBeFocused();
});

test('a saved particle size shows More options already open, and survives a reload of the editor', async ({
  page,
  users,
}) => {
  const user = await signIn(page, users, 'particle-saved');
  const recipe = await createRecipe(users, user, 'Morning V60', { version: { grind_microns: 650 } });
  await page.goto(`/@${user.handle}/${recipe.slug}/edit?v=1`);
  await waitForApp(page);
  await expect(page.getByRole('button', { name: 'More options' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Particle size (µm)')).toHaveValue('650');
});

test('“Change for this brew” takes the same text, spaces included, and shows it as typed', async ({
  page,
  users,
}) => {
  await stubDevice(page);
  const user = await signIn(page, users, 'grind-panel');
  const recipe = await createRecipe(users, user, 'Morning V60', { version: { grind_setting: '7' } });
  await openPrep(page, user, recipe.slug);
  await page.getByRole('button', { name: /Change for this brew/ }).click();

  const field = page.getByLabel('Grind setting', { exact: true });
  await expect(field).toHaveAttribute('type', 'text');
  await expect(field).toHaveAttribute('inputmode', 'text');
  await expect(field).toHaveAttribute('maxlength', '40');
  await expect(field).toHaveAttribute('autocapitalize', 'none');
  await expect(field).toHaveAttribute('autocorrect', 'off');

  for (const text of INPUTS) {
    await field.fill('');
    await field.pressSequentially(text);
    await expect(field).toHaveValue(text);
  }

  // A space typed between words is kept (the saved copy must not trim it away while typing).
  await field.fill('');
  await field.pressSequentially('7.5 fine');
  await expect(field).toHaveValue('7.5 fine');
  await expect(page.getByText('Grind 7 → 7.5 fine')).toBeVisible();
  await expect(page.getByText('Saves as v2 when you log this brew.')).toBeVisible();
});
