import type { Locator, Page } from '@playwright/test';
import { expectNoAxeViolations } from './helpers/axe';
import { expectColumnsFit } from './helpers/layout';
import { baseVersion, createRecipe, saveNextVersion } from './helpers/recipes';
import { expect, logIn, signIn, test, waitForApp } from './helpers/test-users';

// Wider layouts: phones (under 768 px) keep one column, tablets get two-column field rows, and
// from 1024 px the recipe page, editor and list use the width. Needs the staging secret key.
test.use({ serviceWorkers: 'block' });

const WIDTHS = [320, 390, 768, 1024, 1440] as const;

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b, 'element has a box').not.toBeNull();
  return b!;
}

/** True when the two sit on one row (their tops agree to a pixel or two). */
async function sameRow(a: Locator, b: Locator) {
  return Math.abs((await box(a)).y - (await box(b)).y) < 3;
}

async function noSidewaysScroll(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
}

async function setup(
  page: Page,
  users: Parameters<typeof signIn>[1],
  label: string,
  width: number,
) {
  await page.setViewportSize({ width, height: 900 });
  const user = await signIn(page, users, label);
  const recipe = await createRecipe(users, user, 'Morning V60', {
    version: { coffee_name: 'Guji', roaster: 'Origin Roasters', origin: 'Ethiopia' },
  });
  await saveNextVersion(
    users,
    user,
    recipe,
    baseVersion({
      temp_c: 92,
      grind_setting: '22 clicks',
      coffee_name: 'Guji',
      roaster: 'Origin Roasters',
      origin: 'Ethiopia',
      change_note: 'cooler and finer',
    }),
  );
  return { user, recipe, base: `/@${user.handle}/${recipe.slug}` };
}

test.describe('every width fits', () => {
  test('no sideways scroll and no field wider than its cell at 320, 390, 768, 1024 and 1440 px', async ({
    page,
    users,
  }) => {
    test.setTimeout(300_000);
    const { base } = await setup(page, users, 'fit', 1440);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const check = async () => {
        await expectColumnsFit(page);
        await noSidewaysScroll(page, width);
      };

      await page.goto(base);
      await expect(page.getByRole('img', { name: /^Pour curve\./ })).toBeVisible();
      await check();

      await page.goto(`${base}/versions`);
      await expect(page.getByRole('list', { name: 'Versions, newest first' })).toBeVisible();
      await check();

      await page.goto(`${base}/compare?a=1&b=2`);
      await expect(page.getByRole('img', { name: /Pour curves/ })).toBeVisible();
      await check();

      await page.goto(`${base}/edit?v=2`);
      await waitForApp(page);
      await expect(page.getByLabel('Grind setting')).toBeVisible();
      await check();

      await page.goto('/recipes');
      await expect(page.getByRole('list', { name: 'Recipes' })).toBeVisible();
      await check();

      for (const path of [
        '/settings',
        '/settings/units',
        '/settings/gear',
        '/settings/appearance',
        '/profile',
        '/home',
      ]) {
        await page.goto(path);
        await waitForApp(page);
        await check();
      }
    }
  });

  for (const width of WIDTHS) {
    test(`the log-in page fits at ${width} px and stays card-sized`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/login');
      await waitForApp(page);
      await expectColumnsFit(page);
      await noSidewaysScroll(page, width);
      expect((await box(page.getByLabel('Email'))).width).toBeLessThanOrEqual(448);
    });
  }
});

test.describe('recipe page', () => {
  test('one column on a phone and tablet, two columns from 1024 px, four primary key numbers in a row from tablet', async ({
    page,
    users,
  }) => {
    const { base } = await setup(page, users, 'view', 390);
    const steps = () => page.getByRole('region', { name: 'Steps' });
    const gear = () => page.getByRole('region', { name: 'Gear' });
    const keys = () => page.locator('[data-testid="key-numbers"] dl > div');
    const key = (label: RegExp) => keys().filter({ has: page.locator('dt', { hasText: label }) });

    await page.goto(base);
    await expect(page.getByRole('img', { name: /^Pour curve\./ })).toBeVisible();
    // Phone: two key numbers to a row, everything in one column, version info before the numbers.
    expect(await sameRow(keys().nth(0), keys().nth(1))).toBe(true);
    expect(await sameRow(keys().nth(0), keys().nth(2))).toBe(false);
    expect((await box(gear())).y).toBeGreaterThan((await box(steps())).y);

    await page.setViewportSize({ width: 800, height: 900 });
    expect(await sameRow(keys().nth(0), keys().nth(3))).toBe(true); // the four primary numbers in a row
    expect(await sameRow(keys().nth(0), keys().nth(4))).toBe(false); // the supporting tier is below
    const stepsTablet = await box(steps());
    expect((await box(gear())).y).toBeGreaterThan(stepsTablet.y + stepsTablet.height - 1);

    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const s = await box(steps());
      const g = await box(gear());
      expect(g.x).toBeGreaterThanOrEqual(s.x + s.width); // the side column is to the right
      expect(g.y).toBeLessThan(s.y + s.height); // and starts beside the steps, not below them
      const dose = key(/^Dose$/);
      for (const label of [/^Brew water$/, /^Ratio$/, /^Temperature$/]) {
        expect(await sameRow(dose, key(label))).toBe(true);
      }
      expect(await sameRow(dose, key(/^Grind$/))).toBe(false); // the second tier
      await expectColumnsFit(page);
    }
  });
});

test.describe('recipe editor', () => {
  test('field rows, pour rows and the sticky panel at each width', async ({ page, users }) => {
    const { base } = await setup(page, users, 'editor', 390);
    await page.goto(`${base}/edit?v=2`);
    await waitForApp(page);
    const coffee = page.getByRole('textbox', { name: 'Coffee', exact: true });
    const roaster = page.getByLabel('Roaster');
    const origin = page.getByLabel('Origin');
    const step = page.locator('fieldset').first();
    const time = step.getByLabel('Time');
    const target = step.getByLabel(/Scale reads after pouring/);
    const rate = step.getByLabel(/Pour rate/);
    const panel = page.getByRole('region', { name: 'Live numbers' });
    const calculated = page.getByText('Calculated', { exact: true });

    // Phone: everything stacked, panel hidden, numbers inline.
    expect(await sameRow(coffee, roaster)).toBe(false);
    expect(await sameRow(time, target)).toBe(false);
    await expect(panel).toBeHidden();
    await expect(calculated).toBeVisible();

    // Tablet: two across; a pour's fields share a row; numbers still inline.
    await page.setViewportSize({ width: 800, height: 900 });
    expect(await sameRow(coffee, roaster)).toBe(true);
    expect(await sameRow(coffee, origin)).toBe(false);
    expect(await sameRow(time, target)).toBe(true);
    expect(await sameRow(time, rate)).toBe(true);
    await expect(panel).toBeHidden();
    await expect(calculated).toBeVisible();

    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      // Three across.
      expect(await sameRow(coffee, roaster)).toBe(true);
      expect(await sameRow(coffee, origin)).toBe(true);
      expect(await sameRow(time, target)).toBe(true);
      expect(await sameRow(time, rate)).toBe(true);
      // The numbers moved into the panel; the curve is under the steps, not in the panel.
      await expect(calculated).toBeHidden();
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('img', { name: /^Pour curve\./ })).toHaveCount(0);
      await expect(
        page.getByRole('region', { name: 'Steps' }).getByRole('img', { name: /^Pour curve\./ }),
      ).toBeVisible();
      await expect(panel.getByText('Total time')).toBeVisible();
      await expectColumnsFit(page);
    }

    // Targets: three pairs in a row once there is room (1280 px and up), stacked pairs before.
    const drawdown = page.getByText('Drawdown, shortest', { exact: true });
    const tds = page.getByText('TDS % lowest', { exact: true });
    expect(await sameRow(drawdown, tds)).toBe(true); // 1440 px
    await page.setViewportSize({ width: 1100, height: 900 });
    expect(await sameRow(drawdown, tds)).toBe(false);

    // The panel stays in view while the form scrolls.
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const after = await box(panel);
    expect(after.y).toBeGreaterThanOrEqual(0);
    expect(after.y).toBeLessThan(200);

    // Typing updates the panel's numbers.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByLabel('Coffee dose').fill('20');
    await page.getByLabel('Coffee dose').blur();
    await expect(panel.getByText('1:12.5').first()).toBeVisible();
  });
});

test.describe('recipes list', () => {
  test('columns from 1024 px, the stacked row before', async ({ page, users }) => {
    await setup(page, users, 'list', 390);
    await page.goto('/recipes');
    const row = page.getByRole('list', { name: 'Recipes' }).getByRole('listitem').first();
    await expect(row).toBeVisible();
    const heads = page.locator('[aria-hidden="true"]').filter({ hasText: /Dose.*Water.*Ratio/ });
    await expect(heads).toBeHidden();
    await expect(row.getByText('15 g · 250 g', { exact: false })).toBeVisible();

    await page.setViewportSize({ width: 800, height: 900 });
    await expect(heads).toBeHidden();

    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(heads).toBeVisible();
      await expect(row.getByText('15 g · 250 g', { exact: false })).toBeHidden();
      const dose = row.getByText('Dose', { exact: false }).first();
      const water = row.getByText('Water', { exact: false }).first();
      expect(await sameRow(dose, water)).toBe(true);
      // The header labels line up with the cells below them.
      const head = heads.getByText('Water', { exact: true });
      expect(Math.abs((await box(head)).x - (await box(water)).x)).toBeLessThan(6);
      await expectColumnsFit(page);
    }
  });
});

test.describe('compare and versions', () => {
  test('changed values sit side by side from 768 px', async ({ page, users }) => {
    const { base } = await setup(page, users, 'compare', 390);
    await page.goto(`${base}/compare?a=1&b=2`);
    // The curve loads late and pushes the list down; measure after it has.
    await expect(page.getByRole('img', { name: /Pour curves/ })).toBeVisible();
    const item = page.locator('[data-changed]').first();
    await expect(item).toBeVisible();
    await expect(item.getByText('v1', { exact: true })).toBeHidden(); // phone: before → after

    for (const width of [800, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const v1 = item.getByText('v1', { exact: true });
      const v2 = item.getByText('v2', { exact: true });
      await expect(v1).toBeVisible();
      expect(await sameRow(v1, v2)).toBe(true);
      expect((await box(v2)).x).toBeGreaterThan((await box(v1)).x);
      await expectColumnsFit(page);
    }

    // Wide: the changed items use two columns.
    const items = page.locator('[data-changed]');
    expect(await items.count()).toBeGreaterThan(1);
    expect(await sameRow(items.nth(0), items.nth(1))).toBe(true);
  });

  test('versions use two columns from 1024 px', async ({ page, users }) => {
    const { base } = await setup(page, users, 'versions', 390);
    await page.goto(`${base}/versions`);
    const items = page.getByRole('list', { name: 'Versions, newest first' }).getByRole('listitem');
    await expect(items).toHaveCount(2);
    expect(await sameRow(items.nth(0), items.nth(1))).toBe(false);
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await sameRow(items.nth(0), items.nth(1))).toBe(true);
  });
});

test.describe('narrow pages stay narrow', () => {
  test('settings forms are 640 px wide at most and auth cards 448 px', async ({ page, users }) => {
    const user = await users.create('narrow');
    await page.setViewportSize({ width: 1440, height: 900 });
    await logIn(page, user);
    await page.goto('/settings/units');
    await waitForApp(page);
    const form = page.locator('main [class*="_form"]').first();
    await expect(form).toBeVisible();
    expect((await box(form)).width).toBeLessThanOrEqual(641);
    expect((await box(form)).width).toBeGreaterThan(448);

    // Wide is the default (Home, the profile); only auth and settings are narrow.
    for (const wide of ['/home', '/profile']) {
      await page.goto(wide);
      await waitForApp(page);
      expect((await box(page.locator('[data-page-width]').first())).width, wide).toBeGreaterThan(1100);
    }
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility of the wide layouts, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('recipe page, editor, list, versions and compare at 768, 1024 and 1440 px', async ({
      page,
      users,
    }) => {
      test.setTimeout(300_000);
      const { base } = await setup(page, users, `axe-${scheme}`, 1440);
      for (const width of [768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });

        await page.goto(base);
        await expect(page.getByRole('img', { name: /^Pour curve\./ })).toBeVisible();
        await expectNoAxeViolations(page);

        await page.goto(`${base}/edit?v=2`);
        await waitForApp(page);
        await expect(page.getByLabel('Grind setting')).toBeVisible();
        if (width >= 1024) {
          await expect(
            page.getByRole('region', { name: 'Steps' }).getByRole('img', { name: /^Pour curve\./ }),
          ).toBeVisible();
        }
        await expectNoAxeViolations(page);

        await page.goto('/recipes');
        await expect(page.getByRole('list', { name: 'Recipes' })).toBeVisible();
        await expectNoAxeViolations(page);

        await page.goto(`${base}/versions`);
        await expect(page.getByRole('list', { name: 'Versions, newest first' })).toBeVisible();
        await expectNoAxeViolations(page);

        await page.goto(`${base}/compare?a=1&b=2`);
        await expect(page.getByTestId('compare-summary')).toBeVisible();
        await expect(page.getByRole('img', { name: /Pour curves/ })).toBeVisible();
        await expectNoAxeViolations(page);
      }
    });
  });
}
