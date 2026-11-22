import type { Locator, Page } from '@playwright/test';
import { createRecipe } from './helpers/recipes';
import { expectNoAxeViolations } from './helpers/axe';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

// The recipe page's key numbers card and the editor's Numbers grid, as in the prototype: the values
// never wrap, the grid never leaves a field alone on a row, and nothing scrolls sideways.
test.use({ serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London' });

const VARIED = {
  bypass_g: 20,
  bypass_timing: 'after',
  grind_setting: '7.5',
  temp_c: 92,
  gear: { brewer: { name: 'Hario V60 02' }, grinder: { name: '1Zpresso K-Ultra' } },
  steps: [
    { id: 'p1', kind: 'pour', at_s: 0, target_g: 40, temp_c: 65 },
    { id: 'p2', kind: 'pour', at_s: 40, target_g: 150, temp_c: 92 },
    { id: 'p3', kind: 'pour', at_s: 90, target_g: 250, temp_c: 92 },
  ],
};

async function noSidewaysScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
}

/** Each stat's label and value stay on one line and inside their cell. */
async function expectNoWrappedStats(card: Locator) {
  const problems = await card.evaluate((root) => {
    const out: string[] = [];
    for (const el of root.querySelectorAll<HTMLElement>('dt, dt + dd')) {
      const style = getComputedStyle(el);
      const lines = Math.round(el.getBoundingClientRect().height / parseFloat(style.lineHeight));
      if (lines > 1) out.push(`${el.textContent}: ${lines} lines`);
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.textContent}: clipped`);
    }
    return out;
  });
  expect(problems).toEqual([]);
}

/** The distinct row tops of the first tier's stats. */
async function primaryTops(card: Locator) {
  const tops = await card
    .locator('dl')
    .first()
    .locator('> div')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  return new Set(tops).size;
}

for (const width of [1280, 390]) {
  test(`recipe page key numbers at ${width} px: two tiers, no wrapped value, no sideways scroll`, async ({
    page,
    users,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const user = await signIn(page, users, `key-numbers-${width}`);
    const recipe = await createRecipe(users, user, 'Morning V60', { version: VARIED });
    await page.goto(`/@${user.handle}/${recipe.slug}`);
    await expect(page.getByRole('img', { name: /^Pour curve\./ })).toBeVisible();

    const card = page.getByTestId('key-numbers');
    await expectNoWrappedStats(card);
    await noSidewaysScroll(page);

    // Tier one: dose, water, ratio, temperature as a range; tier two: grind with the grinder under it.
    await expect(card).toContainText('15 g');
    await expect(card).toContainText('1:16.7');
    await expect(card).toContainText('65 → 92 °C');
    const grind = card.locator('div', { has: page.locator('dt', { hasText: /^Grind$/ }) }).last();
    await expect(grind.locator('dd').first()).toHaveText('7.5');
    await expect(grind).toContainText('1Zpresso K-Ultra');
    const bypass = card.locator('div', { has: page.locator('dt', { hasText: /^Bypass$/ }) }).last();
    await expect(bypass.locator('dd').first()).toHaveText('20 g');
    await expect(bypass).toContainText('after brewing');

    // Four across on desktop; two across on a phone. Never six narrow columns.
    expect(await primaryTops(card)).toBe(width === 1280 ? 1 : 2);
    await expectNoAxeViolations(page);
  });
}

test('no bypass means no Bypass stat, and a steady temperature shows one value', async ({
  page,
  users,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const user = await signIn(page, users, 'key-numbers-plain');
  const recipe = await createRecipe(users, user);
  await page.goto(`/@${user.handle}/${recipe.slug}`);
  const card = page.getByTestId('key-numbers');
  await expect(card).toContainText('93 °C');
  await expect(card).not.toContainText('→');
  await expect(card.locator('dt', { hasText: /^Bypass$/ })).toHaveCount(0);
});

test.describe('the editor Numbers grid', () => {
  async function open(page: Page, users: Parameters<typeof signIn>[1], label: string, width: number) {
    await page.setViewportSize({ width, height: 900 });
    const user = await signIn(page, users, label);
    const recipe = await createRecipe(users, user, 'Morning V60', { version: VARIED });
    await page.goto(`/@${user.handle}/${recipe.slug}/edit?v=1`);
    await waitForApp(page);
    return { user, recipe };
  }

  test('at 1280 px: two rows of four, same tops, same input heights, no wrapped option', async ({
    page,
    users,
  }) => {
    await open(page, users, 'numbers-1280', 1280);
    const grid = page.getByTestId('numbers-grid');
    const rows = await grid.evaluate((el) => {
      const byTop = new Map<number, { label: string; control: number }[]>();
      for (const child of Array.from(el.children)) {
        const r = child.getBoundingClientRect();
        if (r.width === 0) continue;
        // The box the person types into (or reads): the input, the select button or the bloom value.
        const box = child.querySelector('input, button, [data-bloom-value]') as HTMLElement | null;
        const top = Math.round(r.top);
        byTop.set(top, [
          ...(byTop.get(top) ?? []),
          {
            label: (child.textContent ?? '').trim().slice(0, 24),
            control: Math.round((box?.closest('[class*=control], [data-bloom-value]') ?? box ?? child).getBoundingClientRect().height),
          },
        ]);
      }
      return [...byTop.entries()].sort((a, b) => a[0] - b[0]).map(([, items]) => items);
    });
    // Row 1: dose, water, bypass, temperature. Row 2: grind, hardness, bypass goes in, bloom.
    expect(rows.map((r) => r.length)).toEqual([4, 4]);
    for (const row of rows) expect(new Set(row.map((c) => c.control)).size).toBe(1);

    // Every field in a row has the same top (the grid's rows are the tops found above), in order.
    const x = async (label: string) => (await page.getByLabel(label).first().boundingBox())!.x;
    expect(await x('Coffee dose')).toBeLessThan(await x('Brew water'));
    expect(await x('Brew water')).toBeLessThan(await x('Bypass water'));
    expect(await x('Bypass water')).toBeLessThan(await x('Water temperature'));
    // No hint line in row one.
    for (const label of ['Coffee dose', 'Brew water', 'Bypass water', 'Water temperature']) {
      await expect(page.getByLabel(label).first().locator('xpath=ancestor::*[contains(@class,"field")][1]')).not.toContainText('Added to the cup');
    }
    await expect(page.getByLabel('Bypass water (added to cup)')).toBeVisible();

    // The timing is a one-line select; its options do not wrap.
    const timing = page.getByRole('button', { name: /Bypass goes in/ });
    await expect(timing).toContainText('After brewing');
    await timing.click();
    const options = page.getByRole('option');
    await expect(options).toHaveText(['Before brewing', 'After brewing']);
    const wrapped = await options.evaluateAll((els) =>
      els.filter((e) => {
        const label = e.querySelector('span') ?? e;
        const style = getComputedStyle(label);
        return label.getBoundingClientRect().height > parseFloat(style.lineHeight) * 1.5;
      }).length,
    );
    expect(wrapped).toBe(0);
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('bloom-readout')).toContainText('40 g · until 0:40');
    await expect(page.getByTestId('bloom-readout')).toContainText('From your first pour');
    // The vary switch and its hint sit under the grid, then More options.
    await expect(page.getByText('Each pour sets its own temperature in Steps')).toBeVisible();
    await expect(page.getByRole('button', { name: 'More options' })).toBeVisible();
    await noSidewaysScroll(page);
  });

  test('bypass timing appears only with bypass, and Bloom takes its place without it', async ({
    page,
    users,
  }) => {
    await open(page, users, 'numbers-bypass', 1280);
    const bypass = page.getByLabel('Bypass water');
    const timing = page.getByRole('button', { name: /Bypass goes in/ });
    const bloom = page.getByTestId('bloom-readout');
    await expect(timing).toBeVisible();
    const withTiming = (await bloom.boundingBox())!.x;
    await bypass.fill('');
    await bypass.blur();
    await expect(timing).toHaveCount(0);
    // Bloom moved into the empty cell: no gap in row two.
    expect((await bloom.boundingBox())!.x).toBeLessThan(withTiming);
    await bypass.fill('30');
    await bypass.blur();
    await expect(timing).toContainText('After brewing');
    await timing.click();
    await page.getByRole('option', { name: 'Before brewing' }).click();
    await expect(timing).toContainText('Before brewing');
    await bypass.fill('0');
    await bypass.blur();
    await expect(timing).toHaveCount(0);
  });

  test('values are left-aligned', async ({ page, users }) => {
    await open(page, users, 'numbers-align', 1280);
    for (const label of ['Coffee dose', 'Grind setting']) {
      const align = await page
        .getByLabel(label)
        .first()
        .evaluate((el) => getComputedStyle(el).textAlign);
      expect(['start', 'left']).toContain(align);
    }
  });

  test('at 390 px: two across and no sideways scroll', async ({ page, users }) => {
    await open(page, users, 'numbers-390', 390);
    const columns = await page
      .getByTestId('numbers-grid')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(2);
    await noSidewaysScroll(page);
    await expectNoAxeViolations(page);
  });
});
