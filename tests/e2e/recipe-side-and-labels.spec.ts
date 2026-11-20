import type { Locator, Page } from '@playwright/test';
import { expectColumnsFit } from './helpers/layout';
import { baseVersion, createRecipe, saveNextVersion } from './helpers/recipes';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

// The pour curve's step names stay inside the chart, and the recipe page's side column is made of
// cards that line up with the key numbers. Needs the staging secret key.
test.use({ serviceWorkers: 'block' });

const WIDTHS = [1024, 1440] as const;

/** A swirl and a wait close together, and a step near the end of the curve called "Drawdown". */
const CROWDED_STEPS = [
  { id: 'p1', kind: 'pour', at_s: 0, target_g: 50 },
  { id: 's1', kind: 'swirl', at_s: 12, duration_s: 3 },
  { id: 'w1', kind: 'wait', at_s: 16, duration_s: 4 },
  { id: 'p2', kind: 'pour', at_s: 40, target_g: 150 },
  { id: 'p3', kind: 'pour', at_s: 80, target_g: 250 },
  { id: 'o1', kind: 'other', at_s: 190, duration_s: 10, label: 'Drawdown' },
];

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b, 'element has a box').not.toBeNull();
  return b!;
}

/** Every piece of text drawn in the chart is inside the chart's frame, and no two step names touch. */
async function expectLabelsInside(page: Page, chart: Locator, expectStepNames: boolean) {
  await expect(chart).toBeVisible();
  const frame = await box(chart);
  const texts = await chart.locator('svg text').evaluateAll((nodes) =>
    nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return {
        text: n.textContent ?? '',
        x0: r.left,
        x1: r.right,
        y0: r.top,
        y1: r.bottom,
        step: n.closest('[data-marker-labels]') !== null,
      };
    }),
  );
  expect(texts.length).toBeGreaterThan(0);
  for (const t of texts) {
    expect(t.x0, `"${t.text}" starts inside the chart`).toBeGreaterThanOrEqual(frame.x - 0.5);
    expect(t.x1, `"${t.text}" ends inside the chart`).toBeLessThanOrEqual(
      frame.x + frame.width + 0.5,
    );
    expect(t.y0, `"${t.text}" top is inside the chart`).toBeGreaterThanOrEqual(frame.y - 0.5);
    expect(t.y1, `"${t.text}" bottom is inside the chart`).toBeLessThanOrEqual(
      frame.y + frame.height + 0.5,
    );
  }
  const names = texts.filter((t) => t.step);
  if (expectStepNames) expect(names.length).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const a = names[i]!;
      const b = names[j]!;
      const apart = a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0;
      expect(apart, `"${a.text}" and "${b.text}" do not overlap`).toBe(true);
    }
  }
}

test.describe('pour curve step names', () => {
  test('stay inside the chart on the recipe page, the editor panel and compare', async ({
    page,
    users,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const user = await signIn(page, users, 'labels');
    const recipe = await createRecipe(users, user, 'Crowded', {
      version: { steps: CROWDED_STEPS },
    });
    await saveNextVersion(
      users,
      user,
      recipe,
      baseVersion({ steps: CROWDED_STEPS, change_note: 'again' }),
      'Crowded',
    );
    const base = `/@${user.handle}/${recipe.slug}`;

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });

      await page.goto(base);
      await expectLabelsInside(page, page.getByRole('img', { name: /^Pour curve\./ }), true);

      await page.goto(`${base}/edit?v=2`);
      await waitForApp(page);
      await expectLabelsInside(page, page.getByRole('img', { name: /^Pour curve\./ }), true);

      await page.goto(`${base}/compare?a=1&b=2`);
      await expectLabelsInside(page, page.getByRole('img', { name: /Pour curves/ }), false);
    }
  });
});

/** Many steps, so the main column is taller than the window. */
const MANY_STEPS = Array.from({ length: 16 }, (_, i) => ({
  id: `p${i}`,
  kind: 'pour',
  at_s: i * 12,
  target_g: 15 * (i + 1),
}));

test.describe('recipe page side column', () => {
  test('cards that match the key numbers, line up with them, and stay in view', async ({
    page,
    users,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const user = await signIn(page, users, 'side');
    const recipe = await createRecipe(users, user, 'Full', {
      version: {
        steps: MANY_STEPS,
        coffee_name: 'Guji',
        roaster: 'Origin Roasters',
        origin: 'Ethiopia',
        notes: 'Sweeter with a longer bloom.',
        tds_min: 1.3,
        tds_max: 1.4,
        water_ppm: 90,
      },
    });
    const base = `/@${user.handle}/${recipe.slug}`;

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base);
      await expect(page.getByRole('img', { name: /^Pour curve\./ })).toBeVisible();

      const key = page.locator('dl[aria-label="Key numbers"]');
      const cards = ['Coffee', 'Gear', 'Targets', 'Notes'].map((name) =>
        page.getByRole('region', { name, exact: true }),
      );
      const style = (l: Locator) =>
        l.evaluate((el) => {
          const s = getComputedStyle(el);
          return [
            s.backgroundColor,
            s.borderTopColor,
            s.borderTopWidth,
            s.borderTopLeftRadius,
            s.paddingTop,
            s.paddingLeft,
          ].join(' | ');
        });
      const keyStyle = await style(key);
      for (const card of cards) {
        await expect(card.getByRole('heading', { level: 2 })).toBeVisible();
        expect(await style(card)).toBe(keyStyle);
      }

      // The first card starts level with the key numbers, and the rest sit below it.
      expect(Math.abs((await box(cards[0]!)).y - (await box(key)).y)).toBeLessThan(2);
      expect((await box(cards[1]!)).y).toBeGreaterThan((await box(cards[0]!)).y);

      // Label on the left, value on the right.
      const row = cards[0]!.locator('dl > div').first();
      const dt = await box(row.locator('dt'));
      const dd = await box(row.locator('dd'));
      const card = await box(cards[0]!);
      expect(dt.x).toBeLessThan(dd.x);
      expect(dd.x + dd.width).toBeGreaterThan(card.x + card.width - 32);

      // Scrolled well down, the side column is still at the top of the window.
      await page.evaluate(() => window.scrollTo(0, 500));
      await expect
        .poll(async () => (await box(cards[0]!)).y, { message: 'side column sticks' })
        .toBeLessThan(40);
      expect((await box(cards[0]!)).y).toBeGreaterThanOrEqual(0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expectColumnsFit(page);
    }
  });

  test('a recipe with only gear leaves out the empty sections and still looks balanced', async ({
    page,
    users,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const user = await signIn(page, users, 'gearonly');
    const recipe = await createRecipe(users, user, 'Gear only', {
      version: { drawdown_min_s: null, drawdown_max_s: null },
    });
    const base = `/@${user.handle}/${recipe.slug}`;

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base);
      await expect(page.getByRole('img', { name: /^Pour curve\./ })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Gear', exact: true })).toBeVisible();
      for (const name of ['Coffee', 'Targets', 'Notes']) {
        await expect(page.getByRole('region', { name, exact: true })).toHaveCount(0);
      }
      const gear = await box(page.getByRole('region', { name: 'Gear', exact: true }));
      const key = await box(page.locator('dl[aria-label="Key numbers"]'));
      const steps = await box(page.getByRole('region', { name: 'Steps', exact: true }));
      expect(Math.abs(gear.y - key.y)).toBeLessThan(2);
      expect(gear.x).toBeGreaterThanOrEqual(steps.x + steps.width); // beside the steps, not under them
      await expectColumnsFit(page);
    }
  });
});
