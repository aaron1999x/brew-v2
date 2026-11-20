import { openPrep, stubDevice } from './helpers/brew-device';
import { createRecipe } from './helpers/recipes';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

// The grind setting is free text ("7.5", "2.5.0", "24 clicks"): a plain text input of up to 40
// characters, with no numeric keypad, no auto-capitalising and no auto-correct, in the recipe editor
// and in "Change for this brew". The grind SIZE in µm is the one whole-number field.
test.use({ serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London' });

const INPUTS = ['7.5', '2.5.0', '24 clicks', '7,5'];

test('the recipe editor’s grind setting is a plain text input that keeps what is typed', async ({
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
  // The grind size is the whole-number field.
  await expect(page.getByLabel('Grind size (µm)')).toHaveAttribute('inputmode', 'numeric');

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
    .select('grind_setting')
    .eq('id', recipe.v1Id)
    .single();
  expect(data?.grind_setting).toBe('7.5');
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
