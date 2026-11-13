import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const schemes = ['light', 'dark'] as const;

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

for (const scheme of schemes) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('home page renders and has no accessibility violations', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('coming soon');
      await expect(page.getByText(/^Version/)).toBeVisible();
      await expectNoAxeViolations(page);
    });

    test('/status shows build info and has no accessibility violations', async ({ page }) => {
      await page.goto('/status');
      await expect(page.getByRole('heading', { level: 1, name: 'Status' })).toBeVisible();
      for (const label of ['Version', 'Commit', 'Environment', 'Supabase host', 'Database']) {
        await expect(page.getByText(label, { exact: true })).toBeVisible();
      }
      await expectNoAxeViolations(page);
    });

    test('a missing URL shows the shared "not available" page', async ({ page }) => {
      const response = await page.goto('/this-page-does-not-exist');
      expect(response?.status()).toBe(404);
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toHaveText("This page isn't available");
      await expect(heading).toBeFocused();
      await expect(page.getByRole('link', { name: 'Go to home' })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  });
}

test('the web app manifest is valid and its icons load', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ start_url: '/', display: 'standalone' });
  expect(manifest.icons.map((i: { purpose: string }) => i.purpose)).toContain('maskable');
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }
});
