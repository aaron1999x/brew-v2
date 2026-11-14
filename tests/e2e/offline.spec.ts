import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Needs a production build: the service worker is registered in production builds only.
test('the service worker registers and the offline page shows when there is no connection', async ({
  page,
  context,
}) => {
  await page.goto('/');

  // Registered, with scope "/" and an active worker.
  const registration = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: new URL(reg.scope).pathname, active: Boolean(reg.active) };
  });
  expect(registration).toEqual({ scope: '/', active: true });

  // After one reload the page is controlled by the worker, and the shell is precached.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  // The fallback only works once the offline page itself is precached, not merely "some entries".
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          for (const name of await caches.keys()) {
            if (!name.includes('precache')) continue;
            const cache = await caches.open(name);
            if ((await cache.keys()).some((r) => new URL(r.url).pathname === '/~offline'))
              return true;
          }
          return false;
        }),
      { timeout: 20_000 },
    )
    .toBe(true);

  // Offline: any page navigation falls back to the precached offline page.
  await context.setOffline(true);
  await page.goto('/status');
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText("You're offline");
  await expect(heading).toBeFocused();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
