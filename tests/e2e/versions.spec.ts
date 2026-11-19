import type { Page } from '@playwright/test';
import { expectNoAxeViolations } from './helpers/axe';
import { expectColumnsFit } from './helpers/layout';
import {
  baseVersion,
  createRecipe,
  saveNextVersion,
  seedBrew,
  versionRows,
} from './helpers/recipes';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

// Uses the staging secret key from the runner's environment and skips without it. Service workers
// are blocked: nothing here needs one.
test.use({ serviceWorkers: 'block' });

const NOT_AVAILABLE = "This page isn't available";

async function settled(page: Page) {
  await expect(page.locator('[data-entering]')).toHaveCount(0);
}

/** A number field commits on blur; check what it shows, so a missed keystroke fails right here. */
async function fillNumber(page: Page, label: string, value: string) {
  const field = page.getByLabel(label);
  await field.fill(value);
  await expect(field).toHaveValue(value);
  await field.blur();
  await expect(field).toHaveValue(value);
}

test.describe('editing a version', () => {
  test('an unlocked version is edited in place, with a change summary and note', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'edit-in-place');
    const recipe = await createRecipe(users, user);
    await page.goto(`/@${user.handle}/${recipe.slug}`);
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await page.waitForURL('**/edit?v=1');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Edit v1' })).toBeVisible();
    await expect(page.getByLabel('Name')).toHaveValue('Morning V60');
    await expect(page.getByTestId('change-summary')).toHaveText('No changes yet');

    await page.getByLabel('Grind setting').fill('22 clicks');
    await expect(page.getByTestId('change-summary')).toHaveText('1 field changed');
    await page.getByLabel('Change note (optional)').fill('finer grind');
    await expect(page.getByText('Saves your changes to v1.')).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();

    await page.waitForURL(`**/@${user.handle}/${recipe.slug}`);
    await expect(page.getByText('v1 updated')).toBeVisible();
    await expect(page.locator('main').getByText('22 clicks')).toBeVisible();
    await expect(page.locator('main').getByText('finer grind')).toBeVisible();

    const rows = await versionRows(users, recipe.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ grind_setting: '22 clicks', change_note: 'finer grind' });
  });

  test('saving with nothing changed says so and creates nothing', async ({ page, users }) => {
    const user = await signIn(page, users, 'edit-nothing');
    const recipe = await createRecipe(users, user);
    await page.goto(`/@${user.handle}/${recipe.slug}/edit?v=1`);
    await waitForApp(page);
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(page.getByText(/Nothing has changed/)).toBeVisible();
    expect(await versionRows(users, recipe.id)).toHaveLength(1);
    // Changing something takes the message away.
    await page.getByLabel('Grind setting').fill('23 clicks');
    await expect(page.getByText(/Nothing has changed/)).toHaveCount(0);
  });

  test('"New version" starts from a version and saves the next one, leaving the first as it was', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'new-version');
    const recipe = await createRecipe(users, user);
    await page.goto(`/@${user.handle}/${recipe.slug}`);
    await page.getByRole('link', { name: 'New version' }).click();
    await page.waitForURL('**/new-version?from=1');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1, name: 'New version' })).toBeVisible();
    // Pre-filled from the version it starts from.
    await expect(page.getByLabel('Grind setting')).toHaveValue('24 clicks');

    await fillNumber(page, 'Water temperature', '92');
    await page.getByLabel('Grind setting').fill('22 clicks');
    await expect(page.getByTestId('change-summary')).toHaveText('2 fields changed');
    await page.getByText('See what changed').click();
    await expect(page.getByTestId('review').getByText('Temperature')).toBeVisible();
    await page.getByLabel('Change note (optional)').fill('finer grind, 92 °C');
    await page.getByRole('button', { name: 'Save as v2' }).click();

    await page.waitForURL(`**/@${user.handle}/${recipe.slug}`);
    await expect(page.getByText('Saved as v2')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Morning V60' })).toBeFocused();
    await expect(page.locator('main').getByText('v2 of 2')).toBeVisible();

    const rows = await versionRows(users, recipe.id);
    expect(rows.map((r) => r.version_no)).toEqual([1, 2]);
    expect(rows[0]).toMatchObject({ temp_c: 93, grind_setting: '24 clicks', change_note: null });
    expect(rows[1]).toMatchObject({
      temp_c: 92,
      grind_setting: '22 clicks',
      change_note: 'finer grind, 92 °C',
    });
  });

  test('a version with brews is edited as a new version; name and notes still save in place', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'locked');
    const recipe = await createRecipe(users, user);
    const brew = await seedBrew(users, user.id, recipe.v1Id);

    await page.goto(`/@${user.handle}/${recipe.slug}`);
    await expect(
      page.locator('main').getByText('This version has brews. Changes save as a new version.'),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await waitForApp(page);
    await expect(
      page.getByText('This version has brews, so your changes will be saved as a new version.'),
    ).toBeVisible();

    // Only notes: saved in place, and the version stays locked.
    await page.getByLabel('Notes (optional)').fill('Rinse the filter well');
    await expect(page.getByText('Saves your changes to v1.')).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForURL(`**/@${user.handle}/${recipe.slug}`);
    await expect(page.getByText('v1 updated')).toBeVisible();
    let rows = await versionRows(users, recipe.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ notes: 'Rinse the filter well' });
    expect(rows[0]!.locked_at).not.toBeNull();

    // A brewing change: the next version, and v1 is untouched.
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await waitForApp(page);
    await fillNumber(page, 'Coffee dose', '16');
    await expect(page.getByText('Saves as v2, because v1 has brews.')).toBeVisible();
    await page.getByRole('button', { name: 'Save as v2' }).click();
    await page.waitForURL(`**/@${user.handle}/${recipe.slug}`);
    await expect(page.getByText('Saved as v2')).toBeVisible();
    rows = await versionRows(users, recipe.id);
    expect(rows.map((r) => [r.version_no, r.dose_g])).toEqual([
      [1, 15],
      [2, 16],
    ]);

    await brew.removeBrew();
  });

  test('the database rejects a direct edit of a version with brews', async ({ users, page }) => {
    const user = await signIn(page, users, 'direct-edit');
    const recipe = await createRecipe(users, user);
    await seedBrew(users, user.id, recipe.v1Id);
    const client = await users.clientFor(user);

    const direct = await client.from('recipe_versions').update({ dose_g: 20 }).eq('id', recipe.v1Id);
    expect(direct.error?.message).toContain('version_locked');
    const viaRpc = await client.rpc('save_recipe', {
      p_recipe_id: recipe.id,
      p_name: 'Morning V60',
      p_method: 'pour_over',
      p_method_custom: null,
      p_base_version_id: recipe.v1Id,
      p_version: baseVersion({ dose_g: 20 }),
      p_as_new_version: false,
    });
    expect(viaRpc.error?.message).toContain('version_locked');
    // Notes are still allowed.
    const notes = await client.from('recipe_versions').update({ notes: 'ok' }).eq('id', recipe.v1Id);
    expect(notes.error).toBeNull();
  });
});

test.describe('versions, switcher and compare', () => {
  test('the history lists every version; the switcher and /v/N show an older one', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'history');
    const recipe = await createRecipe(users, user);
    await saveNextVersion(users, user, recipe, baseVersion({ temp_c: 92, change_note: 'cooler' }));
    await seedBrew(users, user.id, recipe.v1Id);

    await page.goto(`/@${user.handle}/${recipe.slug}/versions`);
    const items = page.getByRole('list', { name: 'Versions, newest first' }).getByRole('listitem');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('v2');
    await expect(items.nth(0)).toContainText('Latest');
    await expect(items.nth(0)).toContainText('cooler');
    await expect(items.nth(1)).toContainText('v1');
    await expect(items.nth(1)).toContainText('Locked');
    await expect(items.nth(1).getByRole('link', { name: 'Compare with previous' })).toHaveCount(0);

    await items.nth(1).getByRole('link', { name: 'View' }).click();
    await page.waitForURL(`**/@${user.handle}/${recipe.slug}/v/1`);
    await expect(page.locator('main').getByText('v1 of 2')).toBeVisible();
    await expect(page.getByText(/You.re looking at v1/)).toBeVisible();

    // The switcher goes back to the latest.
    await page.getByRole('button', { name: /Version/ }).click();
    await page.getByRole('option', { name: 'v2 (latest)' }).click();
    await page.waitForURL(`**/@${user.handle}/${recipe.slug}`);
    await expect(page.locator('main').getByText('v2 of 2')).toBeVisible();

    // A version that doesn't exist is as not available as a recipe that doesn't.
    const response = await page.goto(`/@${user.handle}/${recipe.slug}/v/9`);
    expect(response!.status()).toBe(404);
    await expect(page.getByRole('heading', { name: NOT_AVAILABLE })).toBeVisible();
  });

  test('a recipe with one version says how to get a second', async ({ page, users }) => {
    const user = await signIn(page, users, 'one-version');
    const recipe = await createRecipe(users, user);
    await page.goto(`/@${user.handle}/${recipe.slug}/versions`);
    await expect(
      page.getByText('This is the first version. Brew it, then save what you change as v2.'),
    ).toBeVisible();
    await page.goto(`/@${user.handle}/${recipe.slug}/compare`);
    await expect(page.getByText(/only has one version|one version so far/)).toBeVisible();
  });

  test('compare highlights exactly the fields that changed, and overlays both curves', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'compare');
    const recipe = await createRecipe(users, user);
    await saveNextVersion(
      users,
      user,
      recipe,
      baseVersion({ grind_setting: '22 clicks', temp_c: 92, change_note: 'finer, cooler' }),
    );

    await page.goto(`/@${user.handle}/${recipe.slug}`);
    await page.getByRole('link', { name: 'Compare' }).click();
    await page.waitForURL(/\/compare\?a=1&b=2$/);
    await waitForApp(page);

    await expect(page.getByTestId('compare-summary')).toHaveText('2 fields changed from v1 to v2');
    // Exactly these two fields are marked, each with the word and an icon, old to new.
    const changed = page.locator('[data-changed]');
    await expect(changed).toHaveCount(2);
    await expect(changed.nth(0)).toContainText('Temperature');
    await expect(changed.nth(0)).toContainText('Changed');
    await expect(changed.nth(0)).toContainText('93');
    await expect(changed.nth(0)).toContainText('92');
    await expect(changed.nth(1)).toContainText('Grind setting');
    await expect(changed.nth(1)).toContainText('Changed');
    await expect(changed.nth(1)).toContainText('24 clicks');
    await expect(changed.nth(1)).toContainText('22 clicks');
    // Every other section is collapsed to "No changes".
    for (const section of ['Basics', 'Gear', 'Coffee', 'Steps', 'Targets', 'Notes']) {
      await expect(page.getByRole('region', { name: section })).toContainText('No changes');
    }
    // Both curves in one chart, with the table behind it.
    await expect(page.getByRole('img', { name: /Pour curves.*v1 and v2/ })).toBeVisible();
    await page.getByText('Show data table').click();
    await expect(page.getByRole('table').getByRole('columnheader', { name: 'Version' })).toBeVisible();

    // The pickers change the comparison.
    await page.getByRole('button', { name: /Version A/ }).click();
    await page.getByRole('option', { name: 'v2 (latest)' }).click();
    await expect(page.getByText('Choose two different versions to see what changed.')).toBeVisible();
  });

  test('a version in the URL that does not exist is a 404', async ({ page, users }) => {
    const user = await signIn(page, users, 'compare-404');
    const recipe = await createRecipe(users, user);
    const response = await page.goto(`/@${user.handle}/${recipe.slug}/compare?a=1&b=7`);
    expect(response!.status()).toBe(404);
    await expect(page.getByRole('heading', { name: NOT_AVAILABLE })).toBeVisible();
    const edit = await page.goto(`/@${user.handle}/${recipe.slug}/edit?v=7`);
    expect(edit!.status()).toBe(404);
  });
});

test.describe('the pour curve', () => {
  test('has a text alternative and the same data as a table', async ({ page, users }) => {
    const user = await signIn(page, users, 'curve');
    const recipe = await createRecipe(users, user);

    await page.goto(`/@${user.handle}/${recipe.slug}`);
    const curve = page.getByRole('img', { name: /^Pour curve\./ });
    await expect(curve).toBeVisible();
    await expect(curve).toHaveAccessibleName(/ends at 250 g/);
    await expect(curve).toHaveAccessibleName(/Target drawdown between 2:45 and 3:15/);
    await page.getByText('Show data table').click();
    const table = page.getByRole('table', { name: /Steps: time and cumulative water/ });
    await expect(table.getByRole('row')).toHaveCount(5);
    await expect(table.getByRole('row').nth(3)).toContainText('Pour 2');
    await expect(table.getByRole('row').nth(3)).toContainText('0:45');
    await expect(table.getByRole('row').nth(3)).toContainText('150 g');
  });

  test('is an area chart with ramps: unit on the y labels, times on x, light horizontal lines only', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'curve-style');
    const recipe = await createRecipe(users, user);
    await page.goto(`/@${user.handle}/${recipe.slug}`);
    const curve = page.getByRole('img', { name: /^Pour curve\./ });
    await expect(curve).toBeVisible();

    // A gradient fill under the line, and no axis titles.
    await expect(curve.locator('linearGradient')).toHaveCount(1);
    await expect(curve.locator('.recharts-area-area')).toHaveCount(1);
    await expect(curve.locator('.recharts-area-area')).toHaveAttribute('fill', /url\(#/);
    await expect(curve.locator('.recharts-label')).toHaveCount(0);

    // 3 to 5 ticks each way: weights carry the unit, times are m:ss.
    // (Until the person's settings arrive the chart uses the device's default unit, so wait for grams.)
    await expect(
      curve.locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value').first(),
    ).toHaveText(/ g$/);
    const yTicks = await curve.locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value').allTextContents();
    const xTicks = await curve.locator('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value').allTextContents();
    expect(yTicks.length).toBeGreaterThanOrEqual(3);
    expect(yTicks.length).toBeLessThanOrEqual(5);
    for (const tick of yTicks) expect(tick).toMatch(/^\d+(\.\d+)? g$/);
    expect(xTicks.length).toBeGreaterThanOrEqual(3);
    expect(xTicks.length).toBeLessThanOrEqual(5);
    for (const tick of xTicks) expect(tick).toMatch(/^\d+:\d\d$/);

    // Horizontal lines only, and few.
    await expect(curve.locator('.recharts-cartesian-grid-vertical line')).toHaveCount(0);
    const rules = await curve.locator('.recharts-cartesian-grid-horizontal line').count();
    expect(rules).toBeGreaterThanOrEqual(3);
    expect(rules).toBeLessThanOrEqual(5);
  });

  test('the tooltip reads a pour’s target at the pour’s time: "1:10 · 90 g"', async ({ page, users }) => {
    const user = await signIn(page, users, 'curve-tip');
    const recipe = await createRecipe(users, user, 'Tooltip check', {
      version: {
        drawdown_min_s: null,
        drawdown_max_s: null,
        steps: [
          { id: 'a', kind: 'pour', at_s: 0, target_g: 40 },
          { id: 'b', kind: 'pour', at_s: 70, target_g: 90 },
        ],
      },
    });
    await page.goto(`/@${user.handle}/${recipe.slug}`);
    const curve = page.getByRole('img', { name: /^Pour curve\./ });
    await expect(curve.locator('.recharts-area-area')).toHaveCount(1);
    await page.waitForTimeout(800);

    // The chart ends at 1:20 (the second ramp), so 1:10 is 7/8 of the way across the plot area.
    // Mouse positions are relative to the screen, so bring the chart into view first.
    await curve.scrollIntoViewIfNeeded();
    const surface = (await curve.locator('.recharts-surface').boundingBox())!;
    const left = surface.x + 54;
    const width = surface.width - 54 - 12;
    const y = surface.y + surface.height / 2;
    await page.mouse.move(left + (width * 70) / 80, y);
    await expect(page.getByText('1:10 · 90 g')).toBeVisible();

    // Away from a pour, on the flat part: the line's own value.
    await page.mouse.move(left + (width * 30) / 80, y);
    await expect(page.getByText('0:30 · 40 g')).toBeVisible();
  });

  test('on compare, the second version is a dashed line without a fill', async ({ page, users }) => {
    const user = await signIn(page, users, 'curve-compare');
    const recipe = await createRecipe(users, user);
    await saveNextVersion(users, user, recipe, baseVersion({ temp_c: 92 }));
    await page.goto(`/@${user.handle}/${recipe.slug}/compare?a=1&b=2`);
    const curves = page.getByRole('img', { name: /Pour curves/ });
    await expect(curves).toBeVisible();
    await expect(curves.locator('.recharts-area-area')).toHaveCount(1);
    const dashed = curves.locator('.recharts-line-curve[stroke-dasharray]:not([stroke-opacity])');
    await expect(dashed.first()).toBeVisible();
    await expect(curves.locator('.recharts-label')).toHaveCount(0);
  });

  test('shows weights in the person’s unit and keeps stored values metric', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'curve-oz');
    const recipe = await createRecipe(users, user);
    await users.admin.from('user_settings').update({ weight_unit: 'oz' }).eq('user_id', user.id);
    await page.goto(`/@${user.handle}/${recipe.slug}`);
    const curve = page.getByRole('img', { name: /^Pour curve\./ });
    await expect(curve).toHaveAccessibleName(/ends at 8\.82 oz/);
    await page.getByText('Show data table').click();
    await expect(page.getByRole('table').getByRole('row').nth(3)).toContainText('5.29 oz');
    const rows = await versionRows(users, recipe.id);
    expect(rows[0]!.dose_g).toBe(15);
  });
});

test.describe('layout', () => {
  for (const width of [390, 320]) {
  test(`the version screens fit a ${width} px screen: no sideways scroll, no field wider than its column`, async ({
    page,
    users,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const user = await signIn(page, users, `versions-fit-${width}`);
    const recipe = await createRecipe(users, user);
    await saveNextVersion(users, user, recipe, baseVersion({ temp_c: 92, change_note: 'cooler' }));
    const base = `/@${user.handle}/${recipe.slug}`;

    const fits = async () => {
      await expectColumnsFit(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      // The chart is exactly as wide as its card, never wider.
      for (const figure of await page.locator('figure').all()) {
        const box = (await figure.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
      }
    };

    await page.goto(base);
    await expect(page.getByRole('img', { name: /^Pour curve\./ })).toBeVisible();
    await fits();
    await page.goto(`${base}/versions`);
    await expect(page.getByRole('list', { name: 'Versions, newest first' })).toBeVisible();
    await fits();
    await page.goto(`${base}/compare?a=1&b=2`);
    await expect(page.getByRole('img', { name: /Pour curves/ })).toBeVisible();
    await fits();
    await page.goto(`${base}/edit?v=2`);
    await waitForApp(page);
    await page.getByLabel('Grind setting').fill('20 clicks');
    await page.getByText('See what changed').click();
    await fits();
  });
  }
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('recipe page, versions, compare and the editors have no violations', async ({
      page,
      users,
    }) => {
      const user = await signIn(page, users, 'versions-axe');
      const recipe = await createRecipe(users, user);
      await saveNextVersion(users, user, recipe, baseVersion({ temp_c: 92, change_note: 'cooler' }));
      await seedBrew(users, user.id, recipe.v1Id);
      const base = `/@${user.handle}/${recipe.slug}`;

      await page.goto(base);
      await expect(page.getByRole('img', { name: /^Pour curve\./ })).toBeVisible();
      await expectNoAxeViolations(page);

      await page.goto(`${base}/v/1`);
      await expect(page.getByText('This version has brews. Changes save as a new version.')).toBeVisible();
      await expectNoAxeViolations(page);

      await page.goto(`${base}/versions`);
      await expect(page.getByRole('list', { name: 'Versions, newest first' })).toBeVisible();
      await expectNoAxeViolations(page);

      await page.goto(`${base}/compare?a=1&b=2`);
      await expect(page.getByTestId('compare-summary')).toBeVisible();
      await expect(page.getByRole('img', { name: /Pour curves/ })).toBeVisible();
      await expectNoAxeViolations(page);

      // The editor on a locked version, with a change and its summary open.
      await page.goto(`${base}/edit?v=1`);
      await waitForApp(page);
      await page.getByLabel('Grind setting').fill('20 clicks');
      await page.getByText('See what changed').click();
      await expect(page.getByTestId('change-summary')).toHaveText('1 field changed');
      await expectNoAxeViolations(page);

      await page.goto(`${base}/new-version?from=2`);
      await waitForApp(page);
      await expect(page.getByRole('heading', { level: 1, name: 'New version' })).toBeVisible();
      await expectNoAxeViolations(page);
      await settled(page);
    });
  });
}
