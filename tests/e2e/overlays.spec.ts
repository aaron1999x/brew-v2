import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/dev/components');
  // Interacting before React has hydrated does nothing, so wait for the page to say it's ready.
  await page.locator('[data-hydrated="true"]').waitFor();
});

test('a sheet traps focus, closes on Escape and returns focus to its opener', async ({ page }) => {
  const opener = page.getByRole('button', { name: 'Open sheet' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Share this recipe' });
  await expect(dialog).toBeVisible();

  // Tab through everything inside; focus must never leave the dialog.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[role="dialog"]')),
    );
    expect(inside).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('tapping the backdrop closes a normal sheet', async ({ page }) => {
  await page.getByRole('button', { name: 'Open sheet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share this recipe' });
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
});

test('a destructive confirmation ignores the backdrop, starts on Cancel and backs out on Escape', async ({
  page,
}) => {
  const opener = page.getByRole('button', { name: 'Confirm (destructive)' });
  await opener.click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete this brew?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
  // Focus must come back inside the dialog after the stray tap, so Escape still reaches it.
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('the page behind an open sheet does not scroll', async ({ page }) => {
  await page.getByRole('button', { name: 'Open long sheet' }).click();
  await expect(page.getByRole('dialog', { name: 'Terms of the long scroll' })).toBeVisible();
  const overflow = await page.evaluate(() => getComputedStyle(document.documentElement).overflow);
  expect(overflow).toBe('hidden');
});

test('error toasts are assertive alerts with a working Retry; success is polite', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Error with Retry' }).click();
  const alert = page.getByRole('alert').filter({ hasText: "Couldn't reach the server" });
  await expect(alert).toBeVisible();
  await alert.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Retry pressed.')).toBeVisible();
  await expect(alert).toBeHidden();

  await page.getByRole('button', { name: 'Success', exact: true }).click();
  const status = page.getByRole('status').filter({ hasText: 'Saved as v4.' });
  await expect(status).toBeVisible();
});

test('a toast stays at least 5 seconds and waits while hovered', async ({ page }) => {
  await page.getByRole('button', { name: 'Success', exact: true }).click();
  const toast = page.getByRole('status').filter({ hasText: 'Saved as v4.' });
  await expect(toast).toBeVisible();
  await page.waitForTimeout(5000);
  await expect(toast).toBeVisible();
  await toast.hover();
  await page.waitForTimeout(3500);
  await expect(toast).toBeVisible();
});

test('the offline banner appears and disappears with the toggle', async ({ page }) => {
  await page.getByRole('button', { name: 'Go offline' }).click();
  await expect(page.getByText(/Offline\. Brews save on this device/)).toBeVisible();
  await page.getByRole('button', { name: 'Go online' }).click();
  await expect(page.getByText(/Offline\. Brews save on this device/)).toBeHidden();
});

test('the form error summary takes focus and its links focus the field', async ({ page }) => {
  await page.getByRole('button', { name: 'Submit with errors' }).click();
  const summary = page.getByRole('group', { name: /Fix 2 things to continue/ });
  await expect(summary).toBeFocused();
  await summary.getByRole('link', { name: 'Choose a method.' }).click();
  await expect(page.locator('#demo-method')).toBeFocused();
});

test('skeletons are busy, announce once, and offer Retry after the wait', async ({ page }) => {
  const region = page.locator('#feedback [aria-busy="true"]');
  await expect(region).toBeVisible();
  await expect(region.getByRole('status').filter({ hasText: 'Loading recipes' })).toBeAttached();
  await expect(page.getByText('Still loading…')).toBeVisible({ timeout: 6000 });
  await region.getByRole('button', { name: 'Retry' }).click();
  await expect(region).toBeHidden();
});

test('a sheet follows the visible area when the keyboard opens, so a focused field is never covered', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('iphone'), 'Phone layout: bottom sheet');

  await page.getByRole('button', { name: 'Open form sheet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sheet with fields' });
  await expect(dialog).toBeVisible();

  // The on-screen keyboard shrinks the visible area; resizing the viewport is the closest a
  // browser test gets (it fires the same visualViewport resize event).
  const full = page.viewportSize()!;
  const visibleHeight = 300;
  await page.setViewportSize({ width: full.width, height: visibleHeight });

  const last = dialog.getByLabel('Last field');
  await last.focus();

  const inside = async () =>
    page.evaluate(() => {
      const vv = window.visualViewport!;
      const field = document.activeElement as HTMLElement;
      const sheet = field.closest('[role="dialog"]')!.closest('[class*="modal"]') as HTMLElement;
      const f = field.getBoundingClientRect();
      const s = sheet.getBoundingClientRect();
      return {
        viewportHeight: vv.height,
        fieldTop: f.top,
        fieldBottom: f.bottom,
        sheetTop: s.top,
        sheetBottom: s.bottom,
      };
    });

  await expect
    .poll(async () => {
      const r = await inside();
      return r.fieldTop >= 0 && r.fieldBottom <= r.viewportHeight;
    })
    .toBe(true);
  const r = await inside();
  expect(r.sheetTop).toBeGreaterThanOrEqual(0);
  expect(r.sheetBottom).toBeLessThanOrEqual(r.viewportHeight + 1);

  // The first field is reachable too: scrolling the sheet brings it back into view.
  await dialog.getByLabel('First field').focus();
  await expect
    .poll(async () => {
      const q = await inside();
      return q.fieldTop >= 0 && q.fieldBottom <= q.viewportHeight;
    })
    .toBe(true);
});
