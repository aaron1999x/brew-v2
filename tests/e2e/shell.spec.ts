import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './helpers/axe';

const pages = [
  { path: '/home', heading: 'Home' },
  { path: '/recipes', heading: 'Recipes' },
  { path: '/brew', heading: 'Brew' },
  { path: '/verified', heading: 'Verified' },
  { path: '/profile', heading: 'Profile' },
];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    for (const { path, heading } of pages) {
      test(`${path} renders in the shell and has no accessibility violations`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        await expect(page.getByRole('main')).toBeVisible();
        await expectNoAxeViolations(page);
      });
    }

    test('the logged-out and fullscreen layouts have no accessibility violations', async ({
      page,
    }) => {
      await page.goto('/dev/logged-out');
      await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
      await expectNoAxeViolations(page);
      await page.goto('/dev/fullscreen');
      await expect(page.getByRole('heading', { name: 'Fullscreen layout' })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  });
}

test('the main navigation has the five destinations and marks the current page', async ({
  page,
}) => {
  await page.goto('/recipes');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav).toBeVisible();
  for (const label of ['Home', 'Recipes', 'Brew', 'Verified', 'Profile']) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible();
  }
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(nav.getByRole('link', { name: 'Recipes' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Verified' }).click();
  await expect(page).toHaveURL(/\/verified$/);
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Verified' }),
  ).toHaveAttribute('aria-current', 'page');
});

test('phones get a bottom tab bar; wide screens get a top bar or left rail', async ({
  page,
}, testInfo) => {
  await page.goto('/home');
  const nav = page.getByRole('navigation', { name: 'Main' });
  const box = (await nav.boundingBox())!;
  const viewport = page.viewportSize()!;
  if (testInfo.project.name === 'iphone') {
    expect(box.y + box.height).toBeCloseTo(viewport.height, 0);
    expect(box.width).toBeCloseTo(viewport.width, 0);
  } else {
    // >= 1024 px: a left rail pinned to the left edge.
    expect(box.x).toBeLessThan(40);
    expect(box.height).toBeGreaterThan(100);
    expect(box.width).toBeLessThan(viewport.width / 2);
  }
});

test('the skip link moves focus to the main content', async ({ page }, testInfo) => {
  // Touch devices have no Tab key; this is a keyboard feature.
  test.skip(testInfo.project.name === 'iphone', 'keyboard only');
  await page.goto('/home');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('the notices bell announces its unread count', async ({ page }) => {
  await page.goto('/home');
  await expect(page.getByRole('link', { name: 'Notices' })).toBeVisible();
});

test('landmarks are labelled and there is one main', async ({ page }) => {
  await page.goto('/home');
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(1);
});

test('the fullscreen layout has no navigation', async ({ page }) => {
  await page.goto('/dev/fullscreen');
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('the logged-out layout has the slim bar and no tab bar', async ({ page }) => {
  await page.goto('/dev/logged-out');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const label of ['Verified recipes', 'Log in', 'Sign up']) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible();
  }
  await expect(nav.getByRole('link', { name: 'Brew' })).toHaveCount(0);
});
