import { expect, test } from '@playwright/test';
import { openDevPage } from './helpers/dev-page';

test.beforeEach(async ({ page }) => {
  await openDevPage(page);
});

test('every chart is an image with a text alternative and a data table', async ({ page }) => {
  const figures = page.locator('#charts figure');
  await expect(figures).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    const figure = figures.nth(i);
    await expect(figure.locator('[role="img"]')).toHaveAttribute('aria-label', /.{40,}/);
    await figure.getByText('Show data table').click();
    await expect(figure.getByRole('table')).toBeVisible();
    await expect(figure.getByRole('table')).toHaveAccessibleName(/\w/);
  }
});

test('the radar follows the sliders', async ({ page }) => {
  const section = page.locator('#charts');
  const radar = section.locator('figure', { hasText: 'Tasting radar' });
  await radar.getByText('Show data table').click();
  const cell = radar.getByRole('row', { name: /Sweetness/ }).getByRole('cell');
  await expect(cell).toHaveText('6');
  const slider = section.getByRole('slider', { name: 'Sweetness' });
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(cell).toHaveText('7');
});

test('the comparison tells three brews apart without colour', async ({ page }) => {
  const figure = page.locator('#charts figure', { hasText: 'Brew comparison' });
  const legend = figure.getByRole('list', { name: 'Legend' });
  await expect(legend.getByRole('listitem')).toHaveCount(3);
  // Series 2 and 3 are dashed in the legend swatch; series 1 is solid.
  const dashes = await legend
    .locator('line')
    .evaluateAll((els) => els.map((el) => el.getAttribute('stroke-dasharray')));
  expect(dashes[0]).toBeNull();
  expect(dashes[1]).toBeTruthy();
  expect(dashes[2]).toBeTruthy();
  expect(dashes[1]).not.toBe(dashes[2]);
  // Each swatch carries a different marker shape.
  const shapes = await legend
    .getByRole('listitem')
    .evaluateAll((items) =>
      items.map(
        (li) =>
          li.querySelector('svg circle, svg rect:not([stroke-dasharray]), svg polygon')?.tagName,
      ),
    );
  expect(new Set(shapes).size).toBe(3);
});

test('the pour curve and scatter explain their bands in the legend', async ({ page }) => {
  await expect(
    page.locator('#charts figure', { hasText: 'Pour curve' }).getByText('Target drawdown'),
  ).toBeVisible();
  await expect(
    page.locator('#charts figure', { hasText: 'TDS vs extraction' }).getByText('Target box'),
  ).toBeVisible();
});

test('the sliders sit on their tracks: thumb centred on the rail, not over the label', async ({
  page,
}) => {
  const slider = page.locator('#inputs').getByRole('slider', { name: 'Sweetness' });
  await slider.scrollIntoViewIfNeeded();
  const root = page.locator('#inputs [data-rac][class*="slider"]').first();
  const thumb = root.locator('[class*="thumb"]').first();
  const rail = root.locator('[class*="rail"]').first();
  const label = root.locator('label, [class*="label"]').first();
  const t = (await thumb.boundingBox())!;
  const r = (await rail.boundingBox())!;
  const l = (await label.boundingBox())!;
  expect(Math.abs(t.y + t.height / 2 - (r.y + r.height / 2))).toBeLessThan(1.5);
  expect(t.y).toBeGreaterThanOrEqual(l.y + l.height - 1);
  expect(t.width).toBeGreaterThanOrEqual(43.5);
});

test('stepper buttons stay inside their field, side by side at phone width', async ({ page }) => {
  const pair = page.getByTestId('number-pair');
  await pair.scrollIntoViewIfNeeded();
  const groups = pair.getByRole('group');
  await expect(groups).toHaveCount(2);
  const boxes = [(await groups.nth(0).boundingBox())!, (await groups.nth(1).boundingBox())!];
  expect(boxes[0]!.x + boxes[0]!.width).toBeLessThanOrEqual(boxes[1]!.x + 0.5);
  for (let i = 0; i < 2; i++) {
    const buttons = groups.nth(i).getByRole('button');
    await expect(buttons).toHaveCount(2);
    for (let j = 0; j < 2; j++) {
      const b = (await buttons.nth(j).boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(boxes[i]!.x - 0.5);
      expect(b.x + b.width).toBeLessThanOrEqual(boxes[i]!.x + boxes[i]!.width + 0.5);
    }
  }
});
