import { expect, type Page } from '@playwright/test';

/** Opens /dev/components and waits until React is interactive and the lazy charts have rendered. */
export async function openDevPage(page: Page) {
  await page.goto('/dev/components');
  await page.locator('[data-hydrated="true"]').waitFor();
  await expect(page.locator('#charts figure')).toHaveCount(4);
  // ResponsiveContainer needs a frame to measure before it draws the SVG.
  await expect(page.locator('#charts svg.recharts-surface').first()).toBeAttached();
}
