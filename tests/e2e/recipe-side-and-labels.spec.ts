import type { Locator, Page } from '@playwright/test';
import { expectColumnsFit } from './helpers/layout';
import { baseVersion, createRecipe, saveNextVersion } from './helpers/recipes';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

// The pour curve's step names stay inside the chart, and the recipe page's side column is made of
// cards that line up with the key numbers. Needs the staging secret key.
test.use({ serviceWorkers: 'block' });

const WIDTHS = [1024, 1440] as const;
const NARROW = [320, 390, 768] as const;

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
async function expectLabelsInside(
  page: Page,
  chart: Locator,
  expectStepNames: boolean,
  minNames = 3,
) {
  await expect(chart).toBeVisible();
  // Wait for the chart to be laid out and to stop moving (it animates in) before measuring.
  const snapshot = () =>
    chart.evaluate((root) => {
      const texts = [...root.querySelectorAll('svg text')].map((n) => {
        const r = n.getBoundingClientRect();
        return `${n.textContent}:${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}`;
      });
      const paths = [...root.querySelectorAll('path.recharts-curve')].map((p) =>
        p.getAttribute('d'),
      );
      return `${texts.join('|')}#${paths.join('|')}`;
    });
  let previous = '';
  await expect
    .poll(async () => {
      const now = await snapshot();
      const stable = now === previous && !now.includes(',0|') && now.includes('#M');
      previous = now;
      return stable;
    })
    .toBe(true);
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
  // No step name sits on the curve: sample the drawn line and look for points inside a name's box.
  const onLine = await chart.evaluate((root) => {
    const hits: string[] = [];
    const paths = [...root.querySelectorAll<SVGPathElement>('path.recharts-curve')].filter(
      (p) => p.getAttribute('stroke-opacity') !== '0.35',
    );
    for (const label of root.querySelectorAll<SVGTextElement>('[data-marker-labels] text')) {
      const r = label.getBoundingClientRect();
      for (const path of paths) {
        const m = path.getScreenCTM();
        if (!m) continue;
        const length = path.getTotalLength();
        for (let d = 0; d <= length; d += 1) {
          const pt = path.getPointAtLength(d).matrixTransform(m);
          if (pt.x > r.left && pt.x < r.right && pt.y > r.top && pt.y < r.bottom) {
            hits.push(label.textContent ?? '');
            break;
          }
        }
      }
    }
    return { hits, paths: paths.length };
  }, null);
  expect(onLine.paths, 'the drawn line was found').toBeGreaterThan(0);
  expect(
    onLine.hits,
    `step names sit on the line (${onLine.paths} paths, chart ${frame.width}px)`,
  ).toEqual([]);

  const names = texts.filter((t) => t.step);
  if (expectStepNames) expect(names.length).toBeGreaterThanOrEqual(minNames);
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
      // The curve sits under the steps, as wide as the form column, and not in the side panel.
      const steps = await box(page.getByRole('region', { name: 'Steps', exact: true }));
      const curve = await box(page.getByRole('img', { name: /^Pour curve\./ }));
      const list = await box(page.getByRole('group', { name: /^Step 1/ }).first());
      expect(curve.y).toBeGreaterThan(list.y + list.height);
      expect(curve.x + curve.width).toBeLessThanOrEqual(steps.x + steps.width + 1);
      expect(curve.width).toBeGreaterThan(steps.width - 40);
      await expect(page.getByRole('region', { name: 'Live numbers' }).getByRole('img')).toHaveCount(
        0,
      );

      await page.goto(`${base}/compare?a=1&b=2`);
      await expectLabelsInside(page, page.getByRole('img', { name: /Pour curves/ }), false);
    }
  });
});

test.describe('pour curve step names, narrow charts', () => {
  test('stay inside the chart and off the line at 320, 390 and 768 px', async ({ page, users }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const user = await signIn(page, users, 'narrow');
    const recipe = await createRecipe(users, user, 'Narrow', {
      version: { steps: CROWDED_STEPS },
    });
    const base = `/@${user.handle}/${recipe.slug}`;
    for (const width of NARROW) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base);
      // A very narrow chart may drop a name rather than cover the line, so no minimum is asked.
      await expectLabelsInside(page, page.getByRole('img', { name: /^Pour curve\./ }), false, 0);
    }
  });
});

test.describe('editor curve', () => {
  test('is under the steps from 1024 px, updates as steps change, and is absent below', async ({
    page,
    users,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const user = await signIn(page, users, 'live');
    const recipe = await createRecipe(users, user, 'Live');
    await page.goto(`/@${user.handle}/${recipe.slug}/edit?v=1`);
    await waitForApp(page);
    const curve = page.getByRole('img', { name: /^Pour curve\./ });
    await expect(curve).toBeVisible();
    await expect(curve).toHaveAccessibleName(/ends at 250/);
    const last = page.getByRole('group', { name: /^Step 4/ });
    const target = last.getByLabel(/^Scale reads after pouring/);
    await target.fill('300');
    await target.blur();
    await expect(curve).toHaveAccessibleName(/ends at 300/);
    await page.setViewportSize({ width: 800, height: 900 });
    await expect(page.getByRole('img', { name: /^Pour curve\./ })).toHaveCount(0);
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
