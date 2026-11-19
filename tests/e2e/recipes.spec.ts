import type { Locator, Page } from '@playwright/test';
import { expectNoAxeViolations } from './helpers/axe';
import {
  expect,
  logIn,
  signIn,
  test,
  waitForApp,
  type TestUser,
  type TestUsers,
} from './helpers/test-users';

// Uses the staging secret key from the runner's environment and skips without it. Service workers
// are blocked: nothing here needs one.
test.use({ serviceWorkers: 'block' });

const NOT_AVAILABLE = "This page isn't available";

/** A saved recipe for `user`, made the way the app makes one (as that member, so RLS applies). */
async function createRecipe(users: TestUsers, user: TestUser, name = 'Private V60') {
  const client = await users.clientFor(user);
  const { data, error } = await client.rpc('create_recipe', {
    p_name: name,
    p_method: 'pour_over',
    p_method_custom: null,
    p_version: {
      dose_g: 15,
      brew_water_g: 250,
      bypass_g: 0,
      bypass_timing: 'none',
      steps_schema: 1,
      steps: [
        { id: 's1', kind: 'pour', at_s: 0, target_g: 30 },
        { id: 's2', kind: 'wait', at_s: 30, duration_s: 43_200 },
        { id: 's3', kind: 'pour', at_s: 43_230, target_g: 250 },
      ],
      gear: {},
    },
  });
  expect(error).toBeNull();
  return data as { id: string; slug: string };
}

async function settled(page: Page) {
  await expect(page.locator('[data-entering]')).toHaveCount(0);
}

/** A number field commits on blur. */
async function fillNumber(field: Locator, value: string) {
  await field.fill(value);
  await field.blur();
}

async function chooseMethod(page: Page, label: string) {
  // The button is named by its value, then its label ("Choose a method Method").
  await page.getByRole('button', { name: /Method$/ }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

const step = (page: Page, n: number) => page.getByRole('group', { name: new RegExp(`^Step ${n},`) });

test.describe('new recipe', () => {
  test('a 6-step recipe is saved as v1 and shown on its page', async ({ page, users }) => {
    const user = await signIn(page, users, 'recipe');
    await page.goto('/recipes/new');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1, name: 'New recipe' })).toBeVisible();

    await page.getByLabel('Name').fill('Morning V60');
    await chooseMethod(page, 'Pour-over');
    await fillNumber(page.getByLabel('Coffee dose'), '15');
    await fillNumber(page.getByLabel('Brew water'), '250');

    for (const kind of ['Pour', 'Swirl', 'Wait', 'Pour', 'Press', 'Other']) {
      await page.getByRole('button', { name: kind, exact: true }).click();
    }
    await expect(page.getByRole('heading', { level: 3, name: /^Step \d/ })).toHaveCount(6);
    // The second pour reaches the brew water; the last step needs a label.
    await fillNumber(step(page, 4).getByLabel(/Scale reads after pouring/), '250');
    await step(page, 6).getByLabel('Label').fill('Stir the bed');

    await page.getByRole('button', { name: 'Save recipe' }).click();
    await page.waitForURL(`**/@${user.handle}/morning-v60`);
    await expect(page.getByRole('heading', { level: 1, name: 'Morning V60' })).toBeFocused();

    const main = page.locator('main');
    await expect(main.getByText('v1', { exact: true })).toBeVisible();
    await expect(main.getByText('Private', { exact: true })).toBeVisible();
    await expect(main.getByText('1:16.7')).toBeVisible();
    await expect(main.getByRole('listitem').filter({ hasText: 'Stir the bed' })).toBeVisible();

    const { data: recipe } = await users.admin
      .from('recipes')
      .select('name, slug, visibility, latest_version_no, latest_version_id')
      .eq('owner_id', user.id)
      .single();
    expect(recipe).toMatchObject({
      name: 'Morning V60',
      slug: 'morning-v60',
      visibility: 'private',
      latest_version_no: 1,
    });
    const { data: version } = await users.admin
      .from('recipe_versions')
      .select('dose_g, brew_water_g, steps')
      .eq('id', recipe!.latest_version_id)
      .single();
    expect(version).toMatchObject({ dose_g: 15, brew_water_g: 250 });
    expect((version!.steps as { kind: string }[]).map((s) => s.kind)).toEqual([
      'pour',
      'swirl',
      'wait',
      'pour',
      'press',
      'other',
    ]);

    // Back from the recipe goes to where the person came from, not to an empty editor.
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'New recipe' })).toHaveCount(0);
  });

  test('saving with the basics missing shows the summary and each link finds its field', async ({
    page,
    users,
  }) => {
    await signIn(page, users, 'recipe-errors');
    await page.goto('/recipes/new');
    await waitForApp(page);

    await page.getByRole('button', { name: 'Save recipe' }).click();
    await expect(page.getByRole('heading', { name: 'Fix 4 things to continue' })).toBeVisible();
    await expect(page.locator('[aria-labelledby="form-error-summary-title"]')).toBeFocused();
    const summary = page.locator('[aria-labelledby="form-error-summary-title"]');
    await expect(summary.getByRole('link')).toHaveText([
      'Enter a name for the recipe',
      'Choose a method',
      'Enter the coffee dose',
      'Enter the brew water',
    ]);

    await summary.getByRole('link', { name: 'Enter the coffee dose' }).click();
    await expect(page.getByLabel('Coffee dose')).toBeFocused();
    await summary.getByRole('link', { name: 'Enter a name for the recipe' }).click();
    await expect(page.getByLabel('Name')).toBeFocused();
  });

  test('a pour that does not rise is an error on that step', async ({ page, users }) => {
    await signIn(page, users, 'recipe-steps');
    await page.goto('/recipes/new');
    await waitForApp(page);
    await page.getByLabel('Name').fill('Rising');
    await chooseMethod(page, 'Pour-over');
    await fillNumber(page.getByLabel('Coffee dose'), '15');
    await fillNumber(page.getByLabel('Brew water'), '250');
    await page.getByRole('button', { name: 'Pour', exact: true }).click();
    await page.getByRole('button', { name: 'Pour', exact: true }).click();
    await fillNumber(step(page, 2).getByLabel(/Scale reads after pouring/), '10');
    await page.getByRole('button', { name: 'Save recipe' }).click();
    await expect(
      page.locator('[aria-labelledby="form-error-summary-title"]').getByRole('link'),
    ).toHaveText(['Step 2 must reach a higher weight than the pour at step 1']);
  });

  test('offline: says it needs a connection and keeps what was typed', async ({
    page,
    context,
    users,
  }) => {
    await signIn(page, users, 'recipe-offline');
    await page.goto('/recipes/new');
    await waitForApp(page);
    await page.getByLabel('Name').fill('Typed offline');

    await context.setOffline(true);
    await expect(page.getByText(/Creating and editing recipes needs a connection/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Save recipe' }).click();
    await expect(page.getByLabel('Name')).toHaveValue('Typed offline');

    await context.setOffline(false);
    await expect(page.getByLabel('Name')).toHaveValue('Typed offline');
  });

  test('leaving with changes asks first; Keep editing stays; a reload restores the draft', async ({
    page,
    users,
  }) => {
    await signIn(page, users, 'recipe-leave');
    await page.goto('/recipes');
    await page.getByRole('link', { name: 'New recipe' }).first().click();
    await page.waitForURL('**/recipes/new');
    await waitForApp(page);

    // Nothing typed: Cancel leaves at once.
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForURL('**/recipes');

    await page.getByRole('link', { name: 'New recipe' }).first().click();
    await page.waitForURL('**/recipes/new');
    await waitForApp(page);
    await page.getByLabel('Name').fill('Draft recipe');

    await page.getByRole('button', { name: 'Cancel' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Discard this recipe?' });
    await expect(dialog).toBeVisible();
    await settled(page);
    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel('Name')).toHaveValue('Draft recipe');

    // The browser's back button asks too.
    await page.goBack();
    await expect(dialog).toBeVisible();
    await settled(page);
    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page).toHaveURL(/\/recipes\/new$/);

    // A copy is kept on the device.
    await page.waitForTimeout(600);
    await page.reload();
    await waitForApp(page);
    await expect(page.getByText('Restored your unsaved recipe.')).toBeVisible();
    await expect(page.getByLabel('Name')).toHaveValue('Draft recipe');

    await page.getByRole('button', { name: 'Cancel' }).click();
    await settled(page);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click();
    await page.waitForURL('**/recipes');
    await page.goto('/recipes/new');
    await waitForApp(page);
    await expect(page.getByLabel('Name')).toHaveValue('');
  });

  test('gear defaults fill a new recipe, and what is saved keeps its name', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'recipe-gear');
    const { error } = await users.admin.from('gear_items').insert({
      user_id: user.id,
      category: 'brewer',
      custom_name: 'Stone V60',
      nickname: 'Morning dripper',
      is_default: true,
    });
    expect(error).toBeNull();

    await page.goto('/recipes/new');
    await waitForApp(page);
    // The picker shows my nickname; the recipe will keep the real name.
    await expect(page.getByRole('combobox', { name: 'Brewer' })).toHaveValue('Morning dripper');

    await page.getByLabel('Name').fill('Gear check');
    await chooseMethod(page, 'Pour-over');
    await fillNumber(page.getByLabel('Coffee dose'), '15');
    await fillNumber(page.getByLabel('Brew water'), '250');
    await page.getByRole('button', { name: 'Save recipe' }).click();
    await page.waitForURL(`**/@${user.handle}/gear-check`);

    const { data: recipe } = await users.admin
      .from('recipes')
      .select('latest_version_id')
      .eq('owner_id', user.id)
      .single();
    const { data: version } = await users.admin
      .from('recipe_versions')
      .select('gear')
      .eq('id', recipe!.latest_version_id)
      .single();
    expect(version!.gear).toMatchObject({ brewer: { name: 'Stone V60' } });
    expect(JSON.stringify(version!.gear)).not.toContain('Morning dripper');

    // Renaming the gear later doesn't change the recipe.
    await users.admin
      .from('gear_items')
      .update({ custom_name: 'Renamed V60' })
      .eq('user_id', user.id);
    await page.reload();
    await expect(page.locator('main').getByText('Stone V60')).toBeVisible();
  });

  test('every "New recipe" button opens the editor', async ({ page, users }) => {
    await signIn(page, users, 'recipe-links');
    for (const path of ['/recipes', '/home']) {
      await page.goto(path);
      await page.getByRole('link', { name: 'New recipe' }).first().click();
      await page.waitForURL('**/recipes/new');
    }
  });
});

test.describe('recipe URLs and "not available"', () => {
  test('private, other people\'s and missing recipes all look the same', async ({
    page,
    browser,
    users,
  }) => {
    const owner = await users.create('owner');
    const { slug } = await createRecipe(users, owner);

    // The owner sees it.
    await logIn(page, owner);
    await page.goto(`/@${owner.handle}/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Private V60' })).toBeVisible();
    await expect(page.locator('main').getByText('12:00:00')).toBeVisible();

    // Capital letters in the handle go to the lowercase URL, and /u/… to the @ URL.
    await page.goto(`/@${owner.handle.toUpperCase()}/${slug}`);
    await expect(page).toHaveURL(new RegExp(`/@${owner.handle}/${slug}$`));
    await page.goto(`/u/${owner.handle}/${slug}`);
    await expect(page).toHaveURL(new RegExp(`/@${owner.handle}/${slug}$`));

    const missing = await page.goto(`/@${owner.handle}/no-such-recipe`);
    expect(missing!.status()).toBe(404);
    await expect(page.getByRole('heading', { name: NOT_AVAILABLE })).toBeVisible();
    const missingText = await page.locator('body').innerText();

    // Someone else, and a visitor with no session, see exactly the missing page.
    const other = await users.create('other');
    const otherPage = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
    await logIn(otherPage, other);
    for (const p of [otherPage, await (await browser.newContext()).newPage()]) {
      for (const path of [`/@${owner.handle}/${slug}`, `/@${owner.handle}`]) {
        const response = await p.goto(path);
        expect(response!.status()).toBe(404);
        await expect(p.getByRole('heading', { name: NOT_AVAILABLE })).toBeVisible();
        expect(await p.locator('body').innerText()).toBe(missingText);
      }
    }
    await otherPage.context().close();
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('the editor (empty, with steps and errors) and the recipe page have no violations', async ({
      page,
      users,
    }) => {
      const user = await signIn(page, users, 'recipe-axe');
      await page.goto('/recipes/new');
      await waitForApp(page);
      await expectNoAxeViolations(page);

      for (const kind of ['Pour', 'Wait', 'Other']) {
        await page.getByRole('button', { name: kind, exact: true }).click();
      }
      await page.getByRole('button', { name: 'Save recipe' }).click();
      await expect(page.getByRole('heading', { name: /^Fix \d+ things? to continue$/ })).toBeVisible();
      await expectNoAxeViolations(page);

      const { slug } = await createRecipe(users, user);
      await page.goto(`/@${user.handle}/${slug}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Private V60' })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  });
}
