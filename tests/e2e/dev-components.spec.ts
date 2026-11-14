import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './helpers/axe';
import { openDevPage } from './helpers/dev-page';

// The gallery is public in every environment, production included (tests/unit/dev-pages.test.tsx
// checks the gate is gone; /dev/logged-out and /dev/fullscreen are still gated there).
for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('/dev/components loads and has no accessibility violations', async ({ page }) => {
      await openDevPage(page);
      await expect(page.getByRole('heading', { level: 1, name: 'Components' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`the theme switch forces ${theme} and stays accessible`, async ({ page }) => {
    await openDevPage(page);
    await page
      .getByText(theme === 'light' ? 'Light' : 'Dark', { exact: true })
      .first()
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expectNoAxeViolations(page);
    await page.getByText('System', { exact: true }).first().click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  });
}

test('the gallery says what it is, at the top of the page', async ({ page }) => {
  await page.goto('/dev/components');
  const notice = page.getByText('Component gallery — placeholder design and sample data.');
  await expect(notice).toBeVisible();
  // Above the page heading.
  const [n, h] = [
    (await notice.boundingBox())!,
    (await page.getByRole('heading', { level: 1, name: 'Components' }).boundingBox())!,
  ];
  expect(n.y).toBeLessThan(h.y);
});

test('the gallery is kept out of search engines', async ({ page, request }) => {
  await page.goto('/dev/components');
  const robotsMeta = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robotsMeta).toMatch(/noindex/);
  expect(robotsMeta).toMatch(/nofollow/);

  const response = await request.get('/robots.txt');
  expect(response.ok()).toBe(true);
  const text = await response.text();
  expect(text).toMatch(/User-Agent: \*/i);
  expect(text).toMatch(/Allow: \//);
  expect(text).toMatch(/Disallow: \/dev\//);
});
