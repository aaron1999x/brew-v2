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
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
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

  // Row 1: Setup | Results. Row 2: Sensory | the column of Flavour notes and Notes.
  expect(await top(setup!)).toBe(await top(results!));
  expect(await top(sensory!)).toBe(await top(flavour!));
  const boxes = await Promise.all([setup, results, sensory, flavour, notes].map((c) => c!.boundingBox()));
  const [bSetup, bResults, bSensory, bFlavour, bNotes] = boxes.map((b) => b!);
  expect(bResults!.x).toBeGreaterThan(bSetup!.x + bSetup!.width - 2);
  expect(bFlavour!.x).toBeGreaterThan(bSensory!.x + bSensory!.width - 2);
  expect(bSensory!.y).toBeGreaterThan(bSetup!.y + bSetup!.height - 2);
  expect(bNotes!.y).toBeGreaterThan(bFlavour!.y + bFlavour!.height - 2);

  // Inside Sensory: sliders on the left, the big overall score and the radar on the right.
  const slider = await page.getByRole('slider', { name: /^Sweetness/ }).boundingBox();
  const big = await page.getByTestId('overall-score').boundingBox();
  const radar = await page.getByRole('img', { name: /^Taste\./ }).boundingBox();
  expect(big!.x).toBeGreaterThan(slider!.x + slider!.width - 2);
  expect(radar!.x).toBeGreaterThan(slider!.x + slider!.width - 2);
  const overallSlider = await page.getByRole('slider', { name: /^Overall/ }).boundingBox();
  const aftertaste = await page.getByRole('slider', { name: /^Aftertaste/ }).boundingBox();
  expect(overallSlider!.y).toBeGreaterThan(aftertaste!.y); // Overall is under the attributes

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
  expect(await top(card('Sensory'))).toBe(await top(card('Flavour notes')));
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
