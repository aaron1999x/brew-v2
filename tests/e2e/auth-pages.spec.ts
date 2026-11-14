import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './helpers/axe';

// Public auth screens: render without a database (so this also runs in CI), axe in both themes.
const schemes = ['light', 'dark'] as const;
const screens = [
  { path: '/signup', heading: 'Create your account' },
  { path: '/login', heading: 'Log in' },
  { path: '/forgot-password', heading: 'Forgot your password?' },
  { path: '/signup/check-email', heading: 'Check your email' },
  { path: '/auth/confirm?token_hash=abc&type=email', heading: 'Confirm your email' },
  { path: '/auth/confirm?token_hash=abc&type=recovery', heading: 'Choose a new password' },
  { path: '/auth/confirm', heading: 'Link expired' },
  { path: '/reset-password', heading: 'Link expired' },
  { path: '/goodbye', heading: 'Your account has been deleted' },
];

for (const scheme of schemes) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    for (const screen of screens) {
      test(`${screen.path} renders and has no accessibility violations`, async ({ page }) => {
        await page.goto(screen.path);
        await expect(page.getByRole('heading', { level: 1, name: screen.heading })).toBeVisible();
        await expectNoAxeViolations(page);
      });
    }
  });
}

test('the confirm page does not consume anything on GET (no Auth request is made)', async ({
  page,
}) => {
  const authRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/auth/v1/')) authRequests.push(request.url());
  });
  await page.goto('/auth/confirm?token_hash=abc&type=email');
  await expect(page.getByRole('button', { name: 'Confirm email' })).toBeVisible();
  expect(authRequests).toEqual([]);
});

test('the confirm page keeps the token out of search engines and Referer headers', async ({
  page,
}) => {
  await page.goto('/auth/confirm?token_hash=abc&type=email');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
});

test('keyboard: tab through the sign-up form in order and submit with Enter shows errors', async ({
  page,
}) => {
  await page.goto('/signup');
  await page.locator('html[data-app-ready="true"]').waitFor({ state: 'attached' });
  await page.getByLabel('Email').focus();
  const order: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    order.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.getAttribute('name') ?? el?.getAttribute('type') ?? el?.tagName ?? '';
      }),
    );
    await page.keyboard.press('Tab');
  }
  expect(order.slice(0, 5)).toEqual(['email', 'password', 'checkbox', 'display_name', 'handle']);

  await page.getByLabel('Email').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: /fix 4 things/i })).toBeFocused();
});
