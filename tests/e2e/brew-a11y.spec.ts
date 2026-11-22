import type { Page } from '@playwright/test';
import { expectNoAxeViolations } from './helpers/axe';
import { stubDevice } from './helpers/brew-device';
import { logBrewRpc } from './helpers/brews';
import { createRecipe } from './helpers/recipes';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

// axe: zero violations on every screen and state M4 added that the timer spec doesn't cover (it has the
// prep, count-in, running, paused and End brew states), in both themes. Needs the staging secret key.
test.use({ serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London' });

test.beforeEach(async ({ page }) => {
  await stubDevice(page);
});

/** Waits for the page (and its chart, when it has one) to settle, then runs axe. */
async function axe(page: Page, what: string) {
  await waitForApp(page);
  const chart = page.getByRole('img', { name: /^(Taste|Pour curve)/ });
  if (await chart.count()) await expect(chart.first()).toBeVisible();
  // A sheet or toast that is still animating in is sampled mid-animation.
  await expect(page.locator('[data-entering]')).toHaveCount(0);
  await page.waitForTimeout(250);
  try {
    await expectNoAxeViolations(page);
  } catch (error) {
    throw new Error(`axe: ${what}\n${(error as Error).message}`);
  }
}

const slider = (page: Page, label: string) =>
  page.getByRole('slider', { name: new RegExp(`^${label}`) });

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility of the brew screens, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('the brew picker (filled and empty) and the choice sheet', async ({ page, users }) => {
      // One member: the picker is empty first, then filled.
      const user = await signIn(page, users, `a11y-picker-${scheme}`);
      await page.goto('/brew');
      await expect(page.getByText('Create a recipe first, then brew it here.')).toBeVisible();
      await axe(page, 'brew picker, empty');

      await createRecipe(users, user, 'Morning V60');
      await createRecipe(users, user, 'Evening Press', { method: 'french_press' });
      await page.goto('/brew');
      await expect(page.getByRole('button', { name: /Morning V60/ })).toBeVisible();
      await axe(page, 'brew picker, filled');

      await page.getByRole('button', { name: /Morning V60/ }).click();
      await expect(page.getByRole('dialog', { name: 'Brew this recipe' })).toBeVisible();
      await axe(page, 'choice sheet');
    });

    test('the log: empty, filled, with errors, and offline', async ({ page, users, context }) => {
      const user = await signIn(page, users, `a11y-log-${scheme}`);
      const recipe = await createRecipe(users, user, 'Morning V60', {
        version: { tds_min: 1.3, tds_max: 1.5, ey_min: 19, ey_max: 21 },
      });
      await page.goto(`/@${user.handle}/${recipe.slug}?brew=1`);
      await waitForApp(page);
      await page
        .getByRole('dialog', { name: 'Brew this recipe' })
        .getByRole('button', { name: 'Log only' })
        .click();
      await page.waitForURL('**/brews/new?session=*');
      await expect(page.getByRole('img', { name: /^Taste\./ })).toBeVisible();
      await axe(page, 'log, empty');

      // Filled in.
      await slider(page, 'Overall').focus();
      for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
      await slider(page, 'Sweetness').focus();
      await page.keyboard.press('ArrowRight');
      await page.getByLabel('Beverage weight').fill('212');
      await page.getByLabel('Beverage weight').blur();
      await page.getByLabel('TDS (%)').fill('1.4');
      await page.getByLabel('Drawdown').fill('2:52');
      await page.getByLabel('Drawdown').blur();
      await page.getByRole('row', { name: 'peach' }).click();
      await page.getByRole('button', { name: 'Warm' }).click();
      await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Sweet and clean');
      await axe(page, 'log, filled');

      // With errors: no overall and text in a number field.
      await page.reload();
      await waitForApp(page);
      await page.getByLabel('TDS (%)').fill('abc');
      await page.getByRole('button', { name: 'Save', exact: true }).first().click();
      await expect(
        page.getByRole('heading', { name: /^Fix \d things? to continue$/ }),
      ).toBeVisible();
      await axe(page, 'log, errors');

      // Offline: the notice at the top.
      await context.setOffline(true);
      await expect(
        page.getByText('Saving brews needs a connection for now.').first(),
      ).toBeVisible();
      await axe(page, 'log, offline');
      await context.setOffline(false);
    });

    test('brew detail, edit, My brews, /brews, compare, Home and a recipe that is gone', async ({
      page,
      users,
    }) => {
      test.slow();
      const user = await signIn(page, users, `a11y-history-${scheme}`);
      const recipe = await createRecipe(users, user, 'Morning V60', {
        version: { tds_min: 1.3, tds_max: 1.5, ey_min: 19, ey_max: 21 },
      });
      const a = await logBrewRpc(users, user, recipe.v1Id, { beverage_g: 212, tds_pct: 1.4 });
      const b = await logBrewRpc(users, user, recipe.v1Id, {
        brewed_at: new Date(Date.now() - 7_200_000).toISOString(),
        overall: 7,
        sweetness: 6,
        flavours: ['peach', 'cocoa'],
      });

      await page.goto(`/brews/${a}`);
      await axe(page, 'brew detail');
      await page.goto(`/brews/${a}/edit`);
      await axe(page, 'brew edit');
      await page.goto(`/@${user.handle}/${recipe.slug}`);
      await expect(page.getByRole('region', { name: 'My brews' })).toBeVisible();
      await expect(page.getByRole('list', { name: 'Brews' })).toBeVisible();
      await axe(page, 'recipe page with My brews');
      await page.goto('/brews');
      await expect(page.getByRole('list', { name: 'Brews' })).toBeVisible();
      await axe(page, '/brews, filled');
      await page.goto(`/brews/compare?ids=${a},${b}`);
      await expect(page.getByRole('img', { name: /^Taste, compared\./ })).toBeVisible();
      await axe(page, 'compare');

      // Home: an unfinished brew on top of Continue and Recent brews.
      await page.goto(`/@${user.handle}/${recipe.slug}?brew=1`);
      await waitForApp(page);
      await page
        .getByRole('dialog', { name: 'Brew this recipe' })
        .getByRole('button', { name: 'Log only' })
        .click();
      await page.waitForURL('**/brews/new?session=*');
      await page.goto('/home');
      await expect(page.getByRole('heading', { name: 'Recent brews' })).toBeVisible();
      await expect(page.getByText('Finish logging').first()).toBeVisible();
      await axe(page, 'Home with in-progress, Continue and Recent brews');

      // Someone else's brew, and a brew id that doesn't exist: the same "not available" page.
      await page.goto('/brews/00000000-0000-4000-8000-000000000000');
      await expect(page.getByText("This page isn't available")).toBeVisible();
      await axe(page, 'NotAvailable');

      // The recipe is gone: the detail reads from the snapshots.
      await users.admin
        .from('recipes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', recipe.id);
      await page.goto(`/brews/${a}`);
      await expect(page.getByText('This recipe isn’t available any more.')).toBeVisible();
      await axe(page, 'brew detail, recipe gone');
    });

    test('/brews and the My brews empty states', async ({ page, users }) => {
      const user = await signIn(page, users, `a11y-empty-${scheme}`);
      await page.goto('/brews');
      await expect(page.getByText('Brews you log appear here.')).toBeVisible();
      await axe(page, '/brews, empty');

      const recipe = await createRecipe(users, user, 'Morning V60');
      await page.goto(`/@${user.handle}/${recipe.slug}`);
      await expect(page.getByText('No brews of this version yet.')).toBeVisible();
      await axe(page, 'My brews, empty');
    });
  });
}
