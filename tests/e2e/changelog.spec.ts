import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './helpers/axe';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const badgeName = new RegExp(`^Version ${version.replace(/\./g, '\\.')}, view changelog`);

/** Visits a page, then sets what the user last viewed and reloads, so the first-visit store has already run. */
async function visitWithLastViewed(page: Page, path: string, lastViewed: string) {
  await page.goto(path);
  await page.evaluate((v) => window.localStorage.setItem('lastViewedVersion', v), lastViewed);
  await page.reload();
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('/changelog renders the releases and has no accessibility violations', async ({
      page,
    }) => {
      await page.goto('/changelog');
      await expect(page.getByRole('heading', { level: 1, name: "What's new" })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2 }).first()).toContainText(
        /^v\d+\.\d+\.\d+/,
      );
      await expectNoAxeViolations(page);
    });
  });
}

test('each version links to its GitHub Release and entries have quiet "view change" links', async ({
  page,
}) => {
  await page.goto('/changelog');
  const release = page.getByRole('heading', { level: 2 }).first().getByRole('link');
  await expect(release).toHaveAttribute(
    'href',
    /^https:\/\/github\.com\/aaron1999x\/brew-v2\/releases\/tag\/v\d+\.\d+\.\d+$/,
  );
  await expect(release).toHaveAttribute('target', '_blank');
  await expect(release).toHaveAttribute('rel', /noopener/);

  const change = page.getByRole('link', { name: /^view change/ }).first();
  await expect(change).toHaveAttribute(
    'href',
    /github\.com\/aaron1999x\/brew-v2\/commit\/[0-9a-f]{7,}/,
  );
  await expect(change).toHaveText(/view change/);

  // Only the four user-facing sections appear.
  const sections = await page.getByRole('heading', { level: 3 }).allTextContents();
  expect(sections.length).toBeGreaterThan(0);
  for (const title of sections) {
    expect(['New features', 'Fixes', 'Performance', 'Accessibility']).toContain(title);
  }
});

test('the version badge is in the public footer, with the right name and link', async ({
  page,
}) => {
  await page.goto('/changelog');
  const footer = page.getByRole('contentinfo');
  const badge = footer.getByRole('link', { name: badgeName });
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute('href', '/changelog');
  await expect(badge).toHaveText(`v${version}`);
  const box = (await badge.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(43.5);
});

test('the version badge is at the bottom of the profile page on phones and in the rail on desktop', async ({
  page,
}, testInfo) => {
  const phone = testInfo.project.name.startsWith('iphone');

  await page.goto('/profile');
  const badge = page.getByRole('link', { name: badgeName });
  // Exactly one badge is visible: the page's on phones, the rail's at 1024 px and wider.
  await expect(badge).toHaveCount(1);
  await expect(badge).toBeVisible();

  const box = (await badge.boundingBox())!;
  const viewport = page.viewportSize()!;
  if (phone) {
    // On the page, below the empty state and above the tab bar.
    expect(
      page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: badgeName }),
    ).toHaveCount(0);
    expect(box.y + box.height).toBeLessThan(viewport.height);
    const empty = (await page.getByRole('heading', { name: 'Nothing saved yet.' }).boundingBox())!;
    expect(box.y).toBeGreaterThan(empty.y);
  } else {
    // In the left rail, near the bottom.
    expect(box.x).toBeLessThan(260);
    expect(box.y).toBeGreaterThan(viewport.height / 2);
  }
});

test('first visit: no dot, and the current version is stored silently', async ({ page }) => {
  await page.goto('/changelog');
  await expect(page.getByRole('link', { name: badgeName })).toBeVisible();
  await expect(page.getByRole('link', { name: /, new$/ })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('lastViewedVersion')))
    .toBe(version);

  await page.goto('/profile');
  await expect(page.getByRole('link', { name: badgeName })).toBeVisible();
  await expect(page.getByRole('link', { name: /, new$/ })).toHaveCount(0);
});

test('after a version bump the badge shows a dot and ", new"; visiting /changelog clears it', async ({
  page,
}) => {
  await visitWithLastViewed(page, '/profile', '0.0.1');

  const withDot = page.getByRole('link', { name: `Version ${version}, view changelog, new` });
  await expect(withDot).toBeVisible();
  await expect(withDot.locator('[data-new]')).toBeAttached();

  await withDot.click();
  await expect(page).toHaveURL(/\/changelog$/);
  await expect(page.getByRole('link', { name: badgeName })).toBeVisible();
  await expect(page.getByRole('link', { name: /, new$/ })).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem('lastViewedVersion'))).toBe(version);

  // It stays cleared on the next page.
  await page.goto('/profile');
  await expect(page.getByRole('link', { name: /, new$/ })).toHaveCount(0);
});

test('an older stored version than the app never shows the dot the other way round', async ({
  page,
}) => {
  await visitWithLastViewed(page, '/changelog', '99.0.0');
  await expect(page.getByRole('link', { name: /, new$/ })).toHaveCount(0);
});
