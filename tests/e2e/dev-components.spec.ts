import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './helpers/axe';

// CI builds with NEXT_PUBLIC_APP_ENV=staging or local, so the page exists here.
// The production 404 is covered by the unit test of isDevToolsEnabled.
for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('/dev/components loads and has no accessibility violations', async ({ page }) => {
      await page.goto('/dev/components');
      await expect(page.getByRole('heading', { level: 1, name: 'Components' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`the theme switch forces ${theme} and stays accessible`, async ({ page }) => {
    await page.goto('/dev/components');
    await page.getByRole('radio', { name: theme === 'light' ? 'Light' : 'Dark' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expectNoAxeViolations(page);
    await page.getByRole('radio', { name: 'System' }).check();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  });
}
