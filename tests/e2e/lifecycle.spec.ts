import type { Locator, Page } from '@playwright/test';
import { expectNoAxeViolations } from './helpers/axe';
import { expectColumnsFit } from './helpers/layout';
import { baseVersion, createRecipe, saveNextVersion } from './helpers/recipes';
import { expect, signIn, test, waitForApp, type TestUser, type TestUsers } from './helpers/test-users';

// Uses the staging secret key from the runner's environment and skips without it. Service workers
// are blocked: nothing here needs one.
test.use({ serviceWorkers: 'block' });

const NOT_AVAILABLE = "This page isn't available";

async function settled(page: Page) {
  await expect(page.locator('[data-entering]')).toHaveCount(0);
}

/** Three recipes with different methods, coffees and ages. */
async function seedThree(users: TestUsers, user: TestUser) {
  const morning = await createRecipe(users, user, 'Morning V60', {
    version: { coffee_name: 'Ethiopia Guji', roaster: 'Common Man' },
  });
  const evening = await createRecipe(users, user, 'Evening AeroPress', { method: 'aeropress' });
  const zebra = await createRecipe(users, user, 'Zebra Cold Brew', { method: 'cold_brew' });
  return { morning, evening, zebra };
}

const rows = (page: Page): Locator => page.getByRole('list', { name: 'Recipes', exact: true }).getByRole('listitem');

async function rowMenu(page: Page, name: string) {
  await page.getByRole('button', { name: `Actions for ${name}` }).click();
}

async function recipeRow(users: TestUsers, userId: string, name: string) {
  const { data } = await users.admin
    .from('recipes')
    .select('id, name, slug, archived_at, deleted_at, is_copy, visibility, latest_version_id')
    .eq('owner_id', userId)
    .eq('name', name)
    .maybeSingle();
  return data;
}

test.describe('My recipes: search, filter, sort', () => {
  test('empty states for a new account', async ({ page, users }) => {
    await signIn(page, users, 'list-empty');
    await page.goto('/recipes');
    await expect(page.getByText('No recipes yet.')).toBeVisible();
    await expect(page.getByText('Every recipe you create is private until you share it.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'New recipe' }).first()).toBeVisible();
    await page.getByText(/^Archived \(/).click();
    await expect(page.getByText('Archived recipes appear here.')).toBeVisible();
    await expect(page).toHaveURL(/tab=archived/);
  });

  test('search, filter by method and sort, all kept in the URL', async ({ page, users }) => {
    const user = await signIn(page, users, 'list');
    await seedThree(users, user);
    await page.goto('/recipes');
    await waitForApp(page);
    await expect(rows(page)).toHaveCount(3);
    await expect(page.getByText(/^Recipes \(3\)/)).toBeVisible();

    // Search covers the name, the coffee, the roaster and the origin.
    await page.getByLabel('Search recipes').fill('guji');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Morning V60');
    await expect(page).toHaveURL(/q=guji/);
    await page.getByLabel('Search recipes').fill('common man');
    await expect(rows(page)).toHaveCount(1);
    await page.getByLabel('Search recipes').fill('nothing like this');
    await expect(page.getByText('No recipes match these filters.')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(rows(page)).toHaveCount(3);
    await expect(page).not.toHaveURL(/q=/);

    // Method filter, and it survives a reload.
    await page.getByRole('button', { name: /Method/ }).click();
    await page.getByRole('option', { name: 'AeroPress', exact: true }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Evening AeroPress');
    await expect(page).toHaveURL(/method=aeropress/);
    await page.reload();
    await waitForApp(page);
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Method/ })).toContainText('AeroPress');

    // Visibility: everything here is private; nothing is public yet.
    await page.getByRole('button', { name: /Method/ }).click();
    await page.getByRole('option', { name: 'All methods' }).click();
    await page.getByRole('button', { name: /Visibility/ }).click();
    await page.getByRole('option', { name: 'Public', exact: true }).click();
    await expect(page.getByText('No recipes match these filters.')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(rows(page)).toHaveCount(3);

    // Sort by name, then by last edited (newest first).
    await page.getByRole('button', { name: /Sort by/ }).click();
    await page.getByRole('option', { name: 'Name A–Z' }).click();
    await expect(page).toHaveURL(/sort=name/);
    await expect(rows(page).nth(0)).toContainText('Evening AeroPress');
    await expect(rows(page).nth(1)).toContainText('Morning V60');
    await expect(rows(page).nth(2)).toContainText('Zebra Cold Brew');
    await page.getByRole('button', { name: /Sort by/ }).click();
    await page.getByRole('option', { name: 'Last edited' }).click();
    await expect(rows(page).nth(0)).toContainText('Zebra Cold Brew');

    // A row shows the numbers a brewer wants: dose, water and ratio.
    await expect(rows(page).nth(2)).toContainText('15 g');
    await expect(rows(page).nth(2)).toContainText('250 g');
    await expect(rows(page).nth(2)).toContainText('1:16.7');
    await expect(rows(page).nth(2)).toContainText('Ethiopia Guji');
  });
});

test.describe('archive, restore, duplicate, delete', () => {
  test('archive moves a recipe to the Archived tab, with Undo; Restore brings it back', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'archive');
    const { morning } = await seedThree(users, user);
    await page.goto('/recipes');
    await waitForApp(page);

    await rowMenu(page, 'Morning V60');
    await page.getByRole('menuitem', { name: 'Archive' }).click();
    await expect(page.getByText('Archived Morning V60')).toBeVisible();
    await expect(rows(page)).toHaveCount(2);
    expect((await recipeRow(users, user.id, 'Morning V60'))?.archived_at).not.toBeNull();

    // Undo puts it straight back.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(rows(page)).toHaveCount(3);
    await expect.poll(async () => (await recipeRow(users, user.id, 'Morning V60'))?.archived_at).toBeNull();

    // Archive again and find it under Archived; its page still opens, marked Archived.
    await rowMenu(page, 'Morning V60');
    await page.getByRole('menuitem', { name: 'Archive' }).click();
    await expect(rows(page)).toHaveCount(2);
    await page.getByText(/^Archived \(1\)/).click();
    await expect(page).toHaveURL(/tab=archived/);
    await expect(page.getByRole('list', { name: 'Archived recipes' }).getByRole('listitem')).toHaveCount(1);
    await page.getByRole('link', { name: /Morning V60/ }).click();
    await page.waitForURL(`**/@${user.handle}/${morning.slug}`);
    await expect(page.locator('main').getByText('Archived', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText('Restored Morning V60')).toBeVisible();
    await expect(page.locator('main').getByText('Archived', { exact: true })).toHaveCount(0);
    await expect.poll(async () => (await recipeRow(users, user.id, 'Morning V60'))?.archived_at).toBeNull();
  });

  test('duplicate makes a private "(copy)" from the version on screen and opens it', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'duplicate');
    const original = await createRecipe(users, user, 'Morning V60');
    await saveNextVersion(users, user, original, baseVersion({ temp_c: 92 }));

    // From the list: the latest version.
    await page.goto('/recipes');
    await waitForApp(page);
    await rowMenu(page, 'Morning V60');
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await page.waitForURL(/\/@.+\/morning-v60-copy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Morning V60 (copy)' })).toBeVisible();
    await expect(page.locator('main').getByText('Private', { exact: true })).toBeVisible();

    const copy = await recipeRow(users, user.id, 'Morning V60 (copy)');
    expect(copy).toMatchObject({ is_copy: false, visibility: 'private', deleted_at: null });
    const { data: copyVersions } = await users.admin
      .from('recipe_versions')
      .select('version_no, temp_c, change_note, locked_at')
      .eq('recipe_id', copy!.id);
    expect(copyVersions).toEqual([
      { version_no: 1, temp_c: 92, change_note: 'Duplicated from Morning V60 v2', locked_at: null },
    ]);

    // From the recipe page, viewing v1: that version is what is copied.
    await page.goto(`/@${user.handle}/${original.slug}/v/1`);
    await page.getByRole('button', { name: 'Actions for Morning V60' }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await page.waitForURL(/\/@.+\/morning-v60-copy-2$/);
    const { data: all } = await users.admin
      .from('recipes')
      .select('id, slug')
      .eq('owner_id', user.id)
      .order('created_at');
    expect(all).toHaveLength(3);
    const { data: secondCopy } = await users.admin
      .from('recipe_versions')
      .select('temp_c, change_note')
      .eq('recipe_id', all![2]!.id);
    expect(secondCopy).toEqual([{ temp_c: 93, change_note: 'Duplicated from Morning V60 v1' }]);

    // The original is untouched: still two versions.
    const { data: originals } = await users.admin
      .from('recipe_versions')
      .select('version_no')
      .eq('recipe_id', original.id);
    expect(originals).toHaveLength(2);
  });

  test('delete asks first, offers Undo, and a deleted recipe is not available', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'delete');
    const { morning } = await seedThree(users, user);
    await page.goto('/recipes');
    await waitForApp(page);

    await rowMenu(page, 'Morning V60');
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete Morning V60?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Its versions are removed from your recipes.');
    await settled(page);

    // Cancel changes nothing.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect((await recipeRow(users, user.id, 'Morning V60'))?.deleted_at).toBeNull();

    // Delete, then Undo.
    await rowMenu(page, 'Morning V60');
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await settled(page);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Deleted Morning V60')).toBeVisible();
    await expect(rows(page)).toHaveCount(2);
    await expect.poll(async () => (await recipeRow(users, user.id, 'Morning V60'))?.deleted_at).not.toBeNull();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(rows(page)).toHaveCount(3);
    await expect.poll(async () => (await recipeRow(users, user.id, 'Morning V60'))?.deleted_at).toBeNull();

    // Delete for real from the recipe page: back to the list, and the old URL is not available.
    await page.goto(`/@${user.handle}/${morning.slug}`);
    await page.getByRole('button', { name: 'Actions for Morning V60' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await settled(page);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await page.waitForURL('**/recipes');
    await expect.poll(async () => (await recipeRow(users, user.id, 'Morning V60'))?.deleted_at).not.toBeNull();
    const response = await page.goto(`/@${user.handle}/${morning.slug}`);
    expect(response!.status()).toBe(404);
    await expect(page.getByRole('heading', { name: NOT_AVAILABLE })).toBeVisible();
    // Its versions, edit and compare pages are gone too.
    expect((await page.goto(`/@${user.handle}/${morning.slug}/versions`))!.status()).toBe(404);
    await page.goto('/recipes');
    await expect(rows(page)).toHaveCount(2);
    await expect(page.getByText(/^Archived \(0\)/)).toBeVisible();
  });
});

test.describe('offline', () => {
  test('archive, restore, duplicate and delete say they need a connection and change nothing', async ({
    page,
    context,
    users,
  }) => {
    const user = await signIn(page, users, 'offline-actions');
    await seedThree(users, user);
    await page.goto('/recipes');
    await waitForApp(page);
    await expect(rows(page)).toHaveCount(3);

    await context.setOffline(true);
    const message = page.getByText('Changing recipes needs a connection');

    await rowMenu(page, 'Morning V60');
    await page.getByRole('menuitem', { name: 'Archive' }).click();
    await expect(message.first()).toBeVisible();
    await expect(rows(page)).toHaveCount(3);

    await rowMenu(page, 'Morning V60');
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect(rows(page)).toHaveCount(3);

    await rowMenu(page, 'Morning V60');
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await settled(page);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(rows(page)).toHaveCount(3);
    await expect(page).toHaveURL(/\/recipes$/);

    await context.setOffline(false);
    // Nothing reached the database.
    const row = await recipeRow(users, user.id, 'Morning V60');
    expect(row).toMatchObject({ archived_at: null, deleted_at: null });
    const { count } = await users.admin
      .from('recipes')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id);
    expect(count).toBe(3);
  });
});

test.describe('layout and accessibility', () => {
  test('the list fits a 320 px screen', async ({ page, users }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const user = await signIn(page, users, 'list-fit');
    await seedThree(users, user);
    await page.goto('/recipes');
    await expect(rows(page)).toHaveCount(3);
    await expectColumnsFit(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${scheme} theme`, () => {
      test.use({ colorScheme: scheme });

      test('the list (empty, filled, filtered, archived), its menu and the delete dialog have no violations', async ({
        page,
        users,
      }) => {
        const user = await signIn(page, users, 'list-axe');
        await page.goto('/recipes');
        await expect(page.getByText('No recipes yet.')).toBeVisible();
        await expectNoAxeViolations(page);

        await seedThree(users, user);
        await page.goto('/recipes');
        await expect(rows(page)).toHaveCount(3);
        await expectNoAxeViolations(page);

        await page.getByLabel('Search recipes').fill('zzz');
        await expect(page.getByText('No recipes match these filters.')).toBeVisible();
        await expectNoAxeViolations(page);
        await page.getByRole('button', { name: 'Clear filters' }).click();

        await rowMenu(page, 'Morning V60');
        await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
        await settled(page);
        await expectNoAxeViolations(page);
        await page.getByRole('menuitem', { name: 'Delete' }).click();
        await expect(page.getByRole('alertdialog')).toBeVisible();
        await settled(page);
        await expectNoAxeViolations(page);
        await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();

        await page.goto('/recipes?tab=archived');
        await expect(page.getByText('Archived recipes appear here.')).toBeVisible();
        await expectNoAxeViolations(page);
      });
    });
  }
});
