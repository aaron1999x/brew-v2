import type { Locator, Page } from '@playwright/test';
import { stubDevice } from './helpers/brew-device';
import { baseVersion, createRecipe, saveNextVersion } from './helpers/recipes';
import { expect, signIn, test, waitForApp, type TestUser } from './helpers/test-users';

// Wide is the default page width: every page below fills the app's container at 1280 px, the brew log
// and the brew detail lay their cards out in two columns whose cards start at the same top, and no
// page scrolls sideways at 1280 or 390 px. Settings stay narrow. Needs the staging secret key.
test.use({ serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London' });

const WIDE = 1280;
const PHONE = 390;

async function noSidewaysScroll(page: Page) {
  // Charts resize after a window resize, so give the layout a moment to settle.
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    )
    .toBeLessThanOrEqual(0);
}

/**
 * The width of the page's content container (the last element in <main>) against what <main> could
 * give it: the wide container is as wide as main's content box, capped at the 75rem layout width.
 */
async function containerWidths(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main')!;
    const style = getComputedStyle(main);
    const inner =
      main.getBoundingClientRect().width -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    const last = Array.from(main.children).filter((c) => c.getBoundingClientRect().height > 0).at(-1)!;
    const rect = last.getBoundingClientRect();
    return { inner, width: rect.width, cap: 16 * 75 };
  });
}

async function expectWide(page: Page) {
  const { inner, width, cap } = await containerWidths(page);
  // Within the page padding (up to 2 × 16 px) of the most it could be.
  expect(width, 'fills the wide container').toBeGreaterThanOrEqual(Math.min(inner, cap) - 40);
}

const top = async (l: Locator) => Math.round((await l.boundingBox())!.y);

async function logBrewRpc(users: Parameters<typeof signIn>[1], user: TestUser, versionId: string) {
  const client = await users.clientFor(user);
  const { data, error } = await client.rpc('log_brew', {
    p_brew: {
      id: crypto.randomUUID(),
      recipe_version_id: versionId,
      brewed_at: new Date(Date.now() - 3_600_000).toISOString(),
      source: 'manual',
      overall: 8.5,
      sweetness: 7,
      acidity: 6.5,
      brightness: 6,
      body: 7.5,
      clarity: 8,
      balance: 7,
      aftertaste: 6.5,
      flavours: ['peach', 'floral'],
      notes: 'Sweet and clean',
      next_change: 'Grind a touch finer',
      drawdown_s: 172,
    } as never,
  });
  expect(error).toBeNull();
  return (data as { id: string }).id;
}

test.beforeEach(async ({ page }) => {
  await stubDevice(page);
});

test('pages use the wide container at 1280 px and never scroll sideways at 1280 or 390', async ({
  page,
  users,
}) => {
  test.slow();
  const user = await signIn(page, users, 'widths');
  const recipe = await createRecipe(users, user, 'Morning V60');
  await saveNextVersion(users, user, recipe, baseVersion({ temp_c: 92, change_note: 'cooler' }));
  const brewId = await logBrewRpc(users, user, recipe.v1Id);
  const base = `/@${user.handle}/${recipe.slug}`;

  const pages: { name: string; path: string; ready: (p: Page) => Locator }[] = [
    { name: 'Home', path: '/home', ready: (p) => p.getByRole('heading', { name: 'Home' }).first() },
    { name: 'recipes list', path: '/recipes', ready: (p) => p.getByRole('list', { name: 'Recipes' }) },
    { name: 'brew picker', path: '/brew', ready: (p) => p.getByLabel('Search your recipes') },
    { name: 'recipe page', path: base, ready: (p) => p.getByRole('img', { name: /^Pour curve\./ }) },
    { name: 'version compare', path: `${base}/compare`, ready: (p) => p.getByRole('heading', { level: 1 }) },
    { name: 'editor', path: `${base}/edit?v=2`, ready: (p) => p.getByRole('heading', { level: 1, name: /Edit/ }) },
    { name: 'brew detail', path: `/brews/${brewId}`, ready: (p) => p.getByRole('heading', { level: 1, name: 'Morning V60' }) },
  ];

  for (const width of [WIDE, PHONE]) {
    await page.setViewportSize({ width, height: 900 });
    for (const p of pages) {
      await page.goto(p.path);
      await waitForApp(page);
      await expect(p.ready(page), `${p.name} at ${width}`).toBeVisible();
      await noSidewaysScroll(page);
      if (width === WIDE) await expectWide(page);
    }
  }

  // Settings stay narrow (40rem), well inside the wide container.
  await page.setViewportSize({ width: WIDE, height: 900 });
  await page.goto('/settings/units');
  await waitForApp(page);
  const { inner, width } = await containerWidths(page);
  expect(width).toBeLessThanOrEqual(16 * 40 + 1);
  expect(width).toBeLessThan(inner - 200);
});

test('the brew log lays its cards out like the prototype, and starts each row at the same top', async ({
  page,
  users,
}) => {
  const user = await signIn(page, users, 'log-layout');
  const recipe = await createRecipe(users, user, 'Morning V60', {
    version: { tds_min: 1.3, tds_max: 1.5, ey_min: 19, ey_max: 21 },
  });
  await page.setViewportSize({ width: WIDE, height: 900 });
  await page.goto(`/@${user.handle}/${recipe.slug}?brew=1`);
  await waitForApp(page);
  await page.getByRole('dialog', { name: 'Brew this recipe' }).getByRole('button', { name: 'Log only' }).click();
  await page.waitForURL('**/brews/new?session=*');
  await expect(page.getByRole('heading', { level: 1, name: 'Log brew' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^Taste\./ })).toBeVisible();

  const card = (name: string) => page.getByRole('region', { name, exact: true });
  const [setup, results, sensory, flavour, notes] = ['Setup', 'Results', 'Sensory', 'Flavour notes', 'Notes'].map(card);

  // Row 1: Setup | Results. Row 2: Sensory, the full width. Row 3: Flavour notes | Notes.
  const [bSetup, bResults, bSensory, bFlavour, bNotes] = await Promise.all(
    [setup, results, sensory, flavour, notes].map(async (c) => (await c!.boundingBox())!),
  );
  const bottom = (r: { y: number; height: number }) => Math.round(r.y + r.height);
  // The cards in a row share the same top and the same bottom.
  expect(Math.round(bSetup!.y)).toBe(Math.round(bResults!.y));
  expect(bottom(bSetup!)).toBe(bottom(bResults!));
  expect(Math.round(bFlavour!.y)).toBe(Math.round(bNotes!.y));
  expect(bottom(bFlavour!)).toBe(bottom(bNotes!));
  expect(bResults!.x).toBeGreaterThan(bSetup!.x + bSetup!.width - 2);
  expect(bNotes!.x).toBeGreaterThan(bFlavour!.x + bFlavour!.width - 2);
  // Sensory has the whole row, between the two.
  expect(bSensory!.width).toBeGreaterThan(bSetup!.width + bResults!.width - 4);
  expect(bSensory!.y).toBeGreaterThan(bSetup!.y + bSetup!.height - 2);
  expect(bFlavour!.y).toBeGreaterThan(bSensory!.y + bSensory!.height - 2);

  // Inside Sensory: sliders on the left (about 55%), the big overall score above a radar at least
  // 320 px wide on the right, and no heading or card of the chart's own.
  // The sliders column: a bit over half of the card (about 55%).
  const sliders = await page.getByText('Aftertaste', { exact: true }).locator('xpath=ancestor::div[contains(@class,"sliders")]').boundingBox();
  const slider = await page.getByRole('slider', { name: /^Sweetness/ }).boundingBox();
  const big = await page.getByTestId('overall-score').boundingBox();
  const radar = await page.getByRole('img', { name: /^Taste\./ }).boundingBox();
  expect(big!.x).toBeGreaterThan(slider!.x + slider!.width - 2);
  expect(radar!.x).toBeGreaterThan(slider!.x + slider!.width - 2);
  expect(radar!.width).toBeGreaterThanOrEqual(320);
  expect(big!.y).toBeLessThan(radar!.y); // the overall score is above the radar
  expect(sliders!.width / bSensory!.width).toBeGreaterThan(0.4);
  expect(sliders!.width / bSensory!.width).toBeLessThan(0.6);
  await expect(page.getByRole('heading', { name: 'Taste' })).toHaveCount(0);
  // The chart's own title is only for assistive technology: one clipped pixel, not a visible heading.
  expect((await sensory!.getByText('Taste', { exact: true }).boundingBox())!.width).toBeLessThanOrEqual(2);
  const overallSlider = await page.getByRole('slider', { name: /^Overall/ }).boundingBox();
  const aftertaste = await page.getByRole('slider', { name: /^Aftertaste/ }).boundingBox();
  expect(overallSlider!.y).toBeGreaterThan(aftertaste!.y); // Overall is under the attributes

  // Results: the three tiles are one row, with no orphan, inside the card.
  const tiles = await page.getByLabel('Extraction', { exact: true }).locator('> div').evaluateAll((els) =>
    els.map((e) => ({ top: Math.round(e.getBoundingClientRect().top), right: e.getBoundingClientRect().right })),
  );
  expect(tiles).toHaveLength(3);
  expect(new Set(tiles.map((t) => t.top)).size).toBe(1);
  expect(Math.max(...tiles.map((t) => t.right))).toBeLessThanOrEqual(bResults!.x + bResults!.width);

  // Setup: the recipe name and version chip share a line; the chips are one size.
  const name = await page.getByText('Morning V60', { exact: true }).first().boundingBox();
  const version = await setup!.getByText('v1', { exact: true }).boundingBox();
  expect(Math.abs((name!.y + name!.height / 2) - (version!.y + version!.height / 2))).toBeLessThan(12);
  const hot = await page.getByRole('button', { name: 'Hot' }).boundingBox();
  const peach = await page.getByRole('row', { name: 'peach' }).boundingBox();
  expect(Math.round(hot!.height)).toBe(Math.round(peach!.height));

  // Save at the end is the same size as the one in the top bar, aligned right.
  const saves = page.getByRole('button', { name: 'Save', exact: true });
  const first = await saves.first().boundingBox();
  const last = await saves.last().boundingBox();
  expect(Math.round(last!.height)).toBe(Math.round(first!.height));
  expect(Math.round(last!.width)).toBe(Math.round(first!.width));
  expect(last!.x + last!.width).toBeGreaterThan(bSensory!.x + bSensory!.width - 4);

  // The container is the wide one.
  await expectWide(page);
  await noSidewaysScroll(page);

  // Phone: the same cards, stacked in the same order.
  await page.setViewportSize({ width: PHONE, height: 900 });
  const order = await Promise.all([setup, results, sensory, flavour, notes].map((c) => top(c!)));
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(new Set(order).size).toBe(5);
  await noSidewaysScroll(page);
});

test('the brew detail uses the same cards, read-only', async ({ page, users }) => {
  const user = await signIn(page, users, 'detail-layout');
  const recipe = await createRecipe(users, user, 'Morning V60');
  const id = await logBrewRpc(users, user, recipe.v1Id);
  await page.setViewportSize({ width: WIDE, height: 900 });
  await page.goto(`/brews/${id}`);
  await waitForApp(page);
  await expect(page.getByRole('img', { name: /^Taste\./ })).toBeVisible();

  const card = (name: string) => page.getByRole('region', { name, exact: true });
  expect(await top(card('Setup'))).toBe(await top(card('Results')));
  expect(await top(card('Flavour notes'))).toBe(await top(card('Notes')));
  const sensory = (await card('Sensory').boundingBox())!;
  expect(sensory.width).toBeGreaterThan(1000);
  expect((await page.getByRole('img', { name: /^Taste\./ }).boundingBox())!.width).toBeGreaterThanOrEqual(320);
  await expect(page.getByText('Minutes after brewing')).toHaveCount(0);
  await expect(page.getByLabel('Overall score 8.5 out of 10')).toBeVisible();
  await expect(page.getByRole('img', { name: /^Taste\./ })).toHaveAccessibleName(/overall 8\.5/);
  await expectWide(page);
  await noSidewaysScroll(page);
});

test('the timer stays a centred phone-width column on a desktop, with a bigger clock', async ({
  page,
  users,
}) => {
  const user = await signIn(page, users, 'timer-width');
  const recipe = await createRecipe(users, user, 'Morning V60');
  await page.setViewportSize({ width: WIDE, height: 900 });
  await page.goto(`/@${user.handle}/${recipe.slug}?brew=1`);
  await waitForApp(page);
  await page.getByRole('dialog', { name: 'Brew this recipe' }).getByRole('button', { name: 'Guided timer' }).click();
  await page.waitForURL('**/brew?session=*');
  await expect(page.getByRole('button', { name: /^Start/ })).toBeVisible();
  const column = await page.locator('main > div').first().boundingBox();
  expect(column!.width).toBeLessThanOrEqual(16 * 40 + 1);
  expect(Math.abs(column!.x + column!.width / 2 - WIDE / 2)).toBeLessThan(2);
  await noSidewaysScroll(page);
});
