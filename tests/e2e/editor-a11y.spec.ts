import type { Page } from '@playwright/test';
import { expectNoAxeViolations } from './helpers/axe';
import { createRecipe } from './helpers/recipes';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

// Uses the staging secret key from the runner's environment and skips without it. Service workers
// are blocked: nothing here needs one.
test.use({ serviceWorkers: 'block' });

/** Waits until sheets and dialogs have finished their entry animation. */
async function settled(page: Page) {
  await expect(page.locator('[data-entering]')).toHaveCount(0);
}

const FILLED = {
  coffee_name: 'Ethiopia Guji Natural',
  roaster: 'Common Man',
  origin: 'Ethiopia',
  process: 'Natural',
  varietal: 'Heirloom',
  altitude_m: 2100,
  roast_level: 'light',
  roast_date: '2026-11-01',
  colour_reading: 62.5,
  colour_scale: 'Agtron',
  grind_microns: 650,
  water_ppm: 90,
  retention_ratio: 2.1,
  bypass_g: 20,
  bypass_timing: 'after',
  tds_min: 1.3,
  tds_max: 1.45,
  ey_min: 19,
  ey_max: 21,
  notes: 'Rinse the filter. Pour slowly.',
  steps: [
    { id: 'p1', kind: 'pour', at_s: 0, target_g: 40, rate_gps: 4, temp_c: 94, technique: 'Bloom' },
    { id: 's1', kind: 'swirl', at_s: 12, duration_s: 5 },
    { id: 'p2', kind: 'pour', at_s: 45, target_g: 160, temp_c: 92 },
    { id: 'o1', kind: 'other', at_s: 80, label: 'Tap the brewer' },
    { id: 'p3', kind: 'pour', at_s: 100, target_g: 250, temp_c: 90 },
  ],
};

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('the editor filled in (every section, steps with per-pour temperatures) has no violations', async ({
      page,
      users,
    }) => {
      const user = await signIn(page, users, 'editor-filled');
      const recipe = await createRecipe(users, user, 'Fully filled', { version: FILLED });
      await page.goto(`/@${user.handle}/${recipe.slug}/edit?v=1`);
      await waitForApp(page);
      await expect(page.getByRole('textbox', { name: 'Coffee', exact: true })).toHaveValue('Ethiopia Guji Natural');
      await expect(page.getByRole('switch', { name: 'Vary temperature by pour' })).toBeChecked();
      await expect(page.getByRole('group', { name: /^Step 5,/ })).toBeVisible();
      await expectNoAxeViolations(page);

      // A step with a validation error and the error summary at the top.
      await page.getByRole('group', { name: /^Step 4,/ }).getByLabel('Label').fill('');
      await page.getByRole('button', { name: 'Save', exact: true }).first().click();
      await expect(page.getByRole('heading', { name: /^Fix \d+ things? to continue$/ })).toBeVisible();
      await expectNoAxeViolations(page);
    });

    test('the editor while offline has no violations, and keeps what was typed', async ({
      page,
      context,
      users,
    }) => {
      const user = await signIn(page, users, 'editor-offline');
      const recipe = await createRecipe(users, user);
      await page.goto(`/@${user.handle}/${recipe.slug}/edit?v=1`);
      await waitForApp(page);
      await page.getByLabel('Notes (optional)').fill('typed before the connection dropped');
      await context.setOffline(true);
      await expect(
        page.getByText(/Creating and editing recipes needs a connection/).first(),
      ).toBeVisible();
      await expectNoAxeViolations(page);
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByLabel('Notes (optional)')).toHaveValue('typed before the connection dropped');
      await context.setOffline(false);
    });

    test('the not-available page has no violations', async ({ page, users }) => {
      const user = await signIn(page, users, 'not-available-axe');
      const response = await page.goto(`/@${user.handle}/no-such-recipe`);
      expect(response!.status()).toBe(404);
      await expect(page.getByRole('heading', { name: "This page isn't available" })).toBeVisible();
      await expectNoAxeViolations(page);
    });

    test('a locked version’s editor (notice, summary open) and the discard dialog have no violations', async ({
      page,
      users,
    }) => {
      const user = await signIn(page, users, 'editor-dialog');
      const recipe = await createRecipe(users, user);
      await page.goto(`/@${user.handle}/${recipe.slug}/edit?v=1`);
      await waitForApp(page);
      await page.getByLabel('Grind setting').fill('20 clicks');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('alertdialog', { name: 'Discard your changes?' })).toBeVisible();
      await settled(page);
      await expectNoAxeViolations(page);
      await page.getByRole('alertdialog').getByRole('button', { name: 'Keep editing' }).click();
    });
  });
}

test.describe('keyboard', () => {
  test('a recipe can be made, its steps ordered and saved with the keyboard alone', async ({
    page,
    users,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'iphone', 'Keyboard-only path: desktop project');
    const user = await signIn(page, users, 'editor-keys');
    await page.goto('/recipes/new');
    await waitForApp(page);

    // Basics: type the name, Tab to the method, open it, type to jump to an option, choose it.
    await page.getByLabel('Name').focus();
    await page.keyboard.type('Keyboard recipe');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /Method$/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.type('Aero');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: /Method$/ })).toContainText('AeroPress');

    // Numbers: Tab from the dose to the water.
    await page.getByLabel('Coffee dose').focus();
    await page.keyboard.type('15');
    await page.keyboard.press('Tab');
    await page.keyboard.type('250');
    await page.keyboard.press('Tab');

    // Steps: add a pour and a wait with Enter on their buttons; focus lands on the new step's time.
    await page.getByRole('button', { name: 'Pour', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('group', { name: /^Step 1,/ }).getByLabel('Time')).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.type('250');
    await page.getByRole('button', { name: 'Wait', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('group', { name: /^Step 2,/ }).getByLabel('Time')).toBeFocused();

    // Move the wait up: the order changes, and focus stays on the button that was used (or its
    // partner at the end of the list), never lost.
    const headings = () => page.getByRole('heading', { level: 3, name: /^Step \d/ });
    await page.getByRole('button', { name: 'Move step 2 up' }).focus();
    await page.keyboard.press('Enter');
    await expect(headings().nth(0)).toContainText('Wait');
    await expect(page.getByRole('button', { name: 'Move step 1 down' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(headings().nth(0)).toContainText('Pour');
    await expect(page.getByRole('button', { name: 'Move step 2 up' })).toBeFocused();

    // Delete the wait: focus goes to a step heading, not to nothing; Undo is offered.
    await page.getByRole('button', { name: 'Delete step 2' }).focus();
    await page.keyboard.press('Enter');
    await expect(headings()).toHaveCount(1);
    await expect(page.getByRole('heading', { name: /^Step 1/ })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();

    // Save: Enter in a text field submits the form.
    await page.getByLabel('Name').focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(`**/@${user.handle}/keyboard-recipe`);
    await expect(page.getByRole('heading', { level: 1, name: 'Keyboard recipe' })).toBeVisible();

    const { data: recipe } = await users.admin
      .from('recipes')
      .select('method, latest_version_id')
      .eq('owner_id', user.id)
      .single();
    expect(recipe!.method).toBe('aeropress');
    const { data: saved } = await users.admin
      .from('recipe_versions')
      .select('dose_g, brew_water_g, steps')
      .eq('id', recipe!.latest_version_id)
      .single();
    expect(saved).toMatchObject({ dose_g: 15, brew_water_g: 250 });
    expect((saved!.steps as { kind: string; target_g: number }[]).map((s) => [s.kind, s.target_g])).toEqual([
      ['pour', 250],
    ]);
  });

  test('the error summary and the discard dialog work by keyboard', async ({ page, users }, testInfo) => {
    test.skip(testInfo.project.name === 'iphone', 'Keyboard-only path: desktop project');
    await signIn(page, users, 'editor-keys-errors');
    await page.goto('/recipes/new');
    await waitForApp(page);

    await page.getByLabel('Name').focus();
    await page.keyboard.press('Enter');
    const summary = page.locator('[aria-labelledby="form-error-summary-title"]');
    await expect(summary).toBeFocused();
    // Tab into the first link and follow it with Enter: focus lands on the field.
    await page.keyboard.press('Tab');
    await expect(summary.getByRole('link').first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Name')).toBeFocused();

    // Cancel with changes asks; Escape keeps editing.
    await page.keyboard.type('Draft');
    await page.getByRole('button', { name: 'Cancel' }).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog', { name: 'Discard this recipe?' });
    await expect(dialog).toBeVisible();
    await settled(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel('Name')).toHaveValue('Draft');
  });
});
