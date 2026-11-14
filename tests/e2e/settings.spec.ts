import { expectNoAxeViolations } from './helpers/axe';
import type { Page } from '@playwright/test';
import { expect, signIn, test, waitForApp, type TestUsers } from './helpers/test-users';

// Uses the staging secret key from the runner's environment and skips without it (see
// helpers/test-users.ts). Service workers are blocked: nothing here needs one.
test.use({ serviceWorkers: 'block' });

async function choose(page: Page, group: string, option: string) {
  await page.getByRole('radiogroup', { name: group }).locator('label', { hasText: option }).click();
}

async function settingsRow(users: TestUsers, userId: string) {
  const { data, error } = await users.admin
    .from('user_settings')
    .select('temp_unit, weight_unit, date_format, time_format, theme, onboarding')
    .eq('user_id', userId)
    .single();
  expect(error).toBeNull();
  return data!;
}

test.describe('units and region', () => {
  test('switching to °F and oz changes the preview and is saved; stored values stay metric', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'units');
    await page.goto('/settings/units');
    await waitForApp(page);

    const preview = page.getByTestId('units-preview');
    await expect(preview).toContainText('93 °C · 18 g');

    await choose(page, 'Temperature', '°F');
    await choose(page, 'Weight', 'oz');
    await expect(preview).toContainText('199.4 °F · 0.63 oz');
    await choose(page, 'Date order', 'Month first');
    await choose(page, 'Time', '12-hour');
    await expect(preview).toContainText(/[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM)/);

    await expect.poll(async () => (await settingsRow(users, user.id)).temp_unit).toBe('f');
    const row = await settingsRow(users, user.id);
    expect(row).toMatchObject({ weight_unit: 'oz', date_format: 'mdy', time_format: '12h' });

    // The choice survives a reload.
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('units-preview')).toContainText('199.4 °F · 0.63 oz');
  });

  test('the component gallery fields convert for display and keep stored values metric', async ({
    page,
  }) => {
    await page.goto('/dev/components');
    await waitForApp(page);
    const stored = page.getByTestId('stored-values');
    await expect(stored).toHaveText('Stored: 93 °C · 18 g');
    await expect(page.getByLabel('Brew temperature')).toHaveValue('93');

    await page
      .getByRole('radiogroup', { name: 'Show units as' })
      .locator('label', { hasText: '°F and oz' })
      .click();
    await expect(page.getByLabel('Brew temperature')).toHaveValue('199.4');
    await expect(page.getByLabel('Brew dose')).toHaveValue('0.63');
    // Showing them in another unit never rewrites what is stored.
    await expect(stored).toHaveText('Stored: 93 °C · 18 g');
  });
});

test.describe('appearance', () => {
  test('the theme is saved, set in a cookie and rendered on the first response', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'theme');
    await page.goto('/settings/appearance');
    await waitForApp(page);

    await choose(page, 'Theme', 'Dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(async () => (await settingsRow(users, user.id)).theme).toBe('dark');

    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'theme')?.value).toBe('dark');

    // The server already knows: the raw HTML (no JavaScript) carries the attribute.
    const response = await page.context().request.get('/home');
    expect(await response.text()).toMatch(/<html[^>]*data-theme="dark"/);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await choose(page, 'Theme', 'System');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  });

  test('visitors without the cookie follow the system', async ({ page }) => {
    const response = await page.request.get('/login');
    expect(await response.text()).not.toMatch(/<html[^>]*data-theme=/);
  });
});

test.describe('onboarding', () => {
  test('every step can be skipped, then the checklist on Home lists them and can be dismissed', async ({
    page,
    users,
  }) => {
    await signIn(page, users, 'skipper');
    await page.goto('/welcome');
    await waitForApp(page);

    // The handle is already chosen at sign-up, so: units, profile, start.
    const progress = page.getByTestId('onboarding-progress');
    await expect(progress).toHaveText('Step 1 of 3');
    await expect(page.getByRole('heading', { level: 1, name: 'Units and region' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now' }).click();

    await expect(progress).toHaveText('Step 2 of 3');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Photo and experience' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now' }).click();

    await expect(progress).toHaveText('Step 3 of 3');
    await expect(page.getByRole('heading', { level: 1, name: "You're all set" })).toBeVisible();
    await page.getByRole('button', { name: 'Look around' }).click();
    await page.waitForURL('**/home');

    const card = page.getByRole('region', { name: 'Finish your profile' });
    await expect(card).toBeVisible();
    await expect(card.getByRole('link', { name: 'Choose your units' })).toHaveAttribute(
      'href',
      '/settings/units',
    );
    await expect(card.getByRole('link', { name: /photo and your experience/ })).toBeVisible();
    // The gear step is hidden until M3.
    await expect(card.getByText(/gear/i)).toHaveCount(0);

    await card.getByRole('button', { name: 'Dismiss' }).click();
    await expect(card).toHaveCount(0);
    await page.reload();
    await waitForApp(page);
    await expect(page.getByRole('heading', { name: 'Finish your profile' })).toHaveCount(0);
  });

  test('finishing the units step saves the choices pre-filled from the device', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'finisher');
    await page.goto('/welcome');
    await waitForApp(page);

    // Pre-filled from the browser locale (en-US in both projects): °F and oz.
    await expect(page.getByTestId('units-preview')).toContainText('199.4 °F · 0.63 oz');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByTestId('onboarding-progress')).toHaveText('Step 2 of 3');

    await expect.poll(async () => (await settingsRow(users, user.id)).temp_unit).toBe('f');
    const row = await settingsRow(users, user.id);
    expect(row.onboarding).toMatchObject({ steps: { units: 'done' } });
    expect(row.onboarding).toHaveProperty('started_at');

    // Choose an experience level, then the checklist on Home no longer lists anything.
    await page
      .getByRole('radiogroup', { name: /describe your brewing/ })
      .locator('label', { hasText: 'Enthusiast' })
      .click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Look around' }).click();
    await page.waitForURL('**/home');
    await expect(page.getByRole('heading', { name: 'Finish your profile' })).toHaveCount(0);
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('settings screens and Home checklist have no violations', async ({ page, users }) => {
      await signIn(page, users, 'axe');
      for (const [path, ready] of [
        ['/settings', page.getByRole('link', { name: /Units and region/ })],
        ['/settings/units', page.getByTestId('units-preview')],
        ['/settings/appearance', page.getByRole('radiogroup', { name: 'Theme' })],
        ['/home', page.getByRole('heading', { name: 'Finish your profile' })],
      ] as const) {
        await page.goto(path);
        await waitForApp(page);
        await expect(ready).toBeVisible();
        await expectNoAxeViolations(page);
      }
    });

    test('every onboarding step has no violations', async ({ page, users }) => {
      await signIn(page, users, 'axe-welcome');
      await page.goto('/welcome');
      await waitForApp(page);
      await expect(page.getByTestId('units-preview')).toBeVisible();
      await expectNoAxeViolations(page);
      await page.getByRole('button', { name: 'Skip for now' }).click();
      await expect(page.getByRole('radiogroup', { name: /describe your brewing/ })).toBeVisible();
      await expectNoAxeViolations(page);
      await page.getByRole('button', { name: 'Skip for now' }).click();
      await expect(page.getByRole('button', { name: 'Look around' })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  });
}

test('the onboarding steps work by keyboard', async ({ page, users }, testInfo) => {
  test.skip(testInfo.project.name === 'iphone', 'Keyboard-only path: desktop project');
  await signIn(page, users, 'keys');
  await page.goto('/welcome');
  await waitForApp(page);
  await expect(page.getByTestId('units-preview')).toBeVisible();
  const skip = page.getByRole('button', { name: 'Skip for now' });
  await skip.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('onboarding-progress')).toHaveText('Step 2 of 3');
  await page.getByRole('button', { name: 'Skip for now' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Look around' })).toBeVisible();
});
