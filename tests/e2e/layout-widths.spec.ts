import { readdirSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { stubDevice } from './helpers/brew-device';
import { logBrewRpc } from './helpers/brews';
import { baseVersion, createRecipe, saveNextVersion } from './helpers/recipes';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

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
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
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
    const last = Array.from(main.children)
      .filter((c) => c.getBoundingClientRect().height > 0)
      .at(-1)!;
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

test.beforeEach(async ({ page }) => {
  await stubDevice(page);
});

// ---- routes, discovered from src/app ----------------------------------------------------------

type Route = { route: string; file: string };

/** Every page.tsx under src/app as a URL pattern: route groups dropped, /u/[handle] served as /@handle. */
function discoverRoutes(): Route[] {
  const base = path.join(process.cwd(), 'src', 'app');
  const out: Route[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'page.tsx') {
        const rel = path.relative(base, path.dirname(p)).replaceAll('\\', '/');
        const segments = rel.split('/').filter((s) => s && !/^\(.*\)$/.test(s));
        out.push({ route: '/' + segments.join('/'), file: rel });
      }
    }
  })(base);
  return out.sort((a, b) => a.route.localeCompare(b.route));
}

/** Routes the generic check can't open, each with the reason. A new page must be handled or listed here. */
const SKIP: Record<string, string> = {
  '/admin/invites': 'admin only; the test member is not an admin',
  '/welcome': 'onboarding: it redirects once a profile is complete',
  '/u/[handle]': 'a 404 placeholder until M6, renders nothing',
};

/** Pages that need a query string to show anything (`/brews/new` and the timer need a session). */
const QUERY: Record<string, (d: Data) => string> = {
  '/brews/new': (d) => `?session=${d.logSession}`,
  '/brews/compare': (d) => `?ids=${d.brewId},${d.brewId2}`,
  '/u/[handle]/[slug]/v/[n]/brew': (d) => `?session=${d.timerSession}`,
};

type Data = {
  handle: string;
  slug: string;
  brewId: string;
  brewId2: string;
  logSession: string;
  timerSession: string;
};

/** The width each kind of page must have: narrow for settings and auth, the timer column, wide otherwise. */
function expectedWidth(r: Route): 'wide' | 'narrow' | 'timer' {
  if (r.file.endsWith('/v/[n]/brew')) return 'timer';
  if (r.route.startsWith('/settings')) return 'narrow';
  if (r.file.startsWith('(public)/') && !/^\(public\)\/(changelog|dev)\b/.test(r.file))
    return 'narrow';
  if (r.route === '/welcome' || r.route === '/~offline') return 'narrow';
  return 'wide';
}

/** Pages a logged-out visitor sees: the public group, the landing page, status and the gallery. */
const isPublic = (r: Route) =>
  r.file.startsWith('(public)/') ||
  ['/', '/status', '/dev/components', '/~offline'].includes(r.route);

function resolve(r: Route, d: Data): string {
  const url = r.route
    .replace('/u/[handle]', `/@${d.handle}`)
    .replace('[handle]', d.handle)
    .replace('[slug]', d.slug)
    .replace('[n]', '2') // the latest version: the sessions are made for it
    .replace('[id]', d.brewId);
  const unknown = url.match(/\[(\w+)\]/);
  if (unknown)
    throw new Error(
      `Give the layout test data for [${unknown[1]}] (route ${r.route}), or list the route in SKIP.`,
    );
  return url + (QUERY[r.route]?.(d) ?? '');
}

async function checkPage(page: Page, r: Route, url: string, width: number) {
  await page.goto(url);
  await page.waitForSelector('[data-page-width]');
  const shell = page.locator('[data-page-width]').first();
  const want = expectedWidth(r);
  await expect(shell, `${r.route} uses PageShell width="${want}"`).toHaveAttribute(
    'data-page-width',
    want,
  );
  // Measured in the page (a heavy page may re-render once, which can detach the element under a locator).
  const box = await page.evaluate(() => {
    const el = document.querySelector('[data-page-width]');
    return el ? { width: el.getBoundingClientRect().width } : null;
  });
  expect(box, `${r.route} at ${width}: the page shell has a box`).not.toBeNull();
  if (want === 'wide') {
    // As wide as its container allows, up to the 75rem layout width (the page may add its own padding).
    const room = await page.evaluate(() => {
      const main = document.querySelector('main');
      const rect = (main ?? document.body).getBoundingClientRect();
      return rect.width;
    });
    expect(box!.width, `${r.route} at ${width}: wide`).toBeGreaterThanOrEqual(
      Math.min(room, 16 * 75) - 40,
    );
  } else {
    expect(box!.width, `${r.route} at ${width}: narrow or timer`).toBeLessThanOrEqual(16 * 40 + 1);
  }
  await noSidewaysScroll(page);
}

test('every page under src/app uses its width at 1280 and 390 px and never scrolls sideways', async ({
  page,
  users,
  browser,
}) => {
  test.slow();
  test.setTimeout(240_000);
  const routes = discoverRoutes().filter((r) => !SKIP[r.route]);
  expect(routes.length).toBeGreaterThan(30);

  // Test data: a member with a recipe (two versions), a brew, a log session and a timer session.
  const user = await signIn(page, users, 'widths');
  const recipe = await createRecipe(users, user, 'Morning V60');
  await saveNextVersion(users, user, recipe, baseVersion({ temp_c: 92, change_note: 'cooler' }));
  const brewId = await logBrewRpc(users, user, recipe.v1Id);
  const brewId2 = await logBrewRpc(users, user, recipe.v1Id, { overall: 7, sweetness: 6 });
  const session = async (button: 'Log only' | 'Guided timer', pattern: string) => {
    await page.goto(`/@${user.handle}/${recipe.slug}?brew=1`);
    await waitForApp(page);
    await page
      .getByRole('dialog', { name: 'Brew this recipe' })
      .getByRole('button', { name: button })
      .click();
    await page.waitForURL(pattern);
    return new URL(page.url()).searchParams.get('session')!;
  };
  const logSession = await session('Log only', '**/brews/new?session=*');
  const timerSession = await session('Guided timer', '**/brew?session=*');
  const data: Data = {
    handle: user.handle,
    slug: recipe.slug,
    brewId,
    brewId2,
    logSession,
    timerSession,
  };

  // Signed-out pages in a clean context, the rest as the member.
  const anon = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
  await stubDevice(anon);
  for (const width of [WIDE, PHONE]) {
    for (const r of routes) {
      const url = resolve(r, data);
      const target = isPublic(r) ? anon : page;
      await target.setViewportSize({ width, height: 900 });
      await checkPage(target, r, url, width);
    }
  }
  await anon.context().close();
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
  await page
    .getByRole('dialog', { name: 'Brew this recipe' })
    .getByRole('button', { name: 'Log only' })
    .click();
  await page.waitForURL('**/brews/new?session=*');
  await expect(page.getByRole('heading', { level: 1, name: 'Log brew' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^Taste\./ })).toBeVisible();

  const card = (name: string) => page.getByRole('region', { name, exact: true });
  const [setup, results, sensory, flavour, notes] = [
    'Setup',
    'Results',
    'Sensory',
    'Flavour notes',
    'Notes',
  ].map(card);

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
  const sliders = await page
    .getByText('Aftertaste', { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"sliders")]')
    .boundingBox();
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
  expect(
    (await sensory!.getByText('Taste', { exact: true }).boundingBox())!.width,
  ).toBeLessThanOrEqual(2);
  const overallSlider = await page.getByRole('slider', { name: /^Overall/ }).boundingBox();
  const aftertaste = await page.getByRole('slider', { name: /^Aftertaste/ }).boundingBox();
  expect(overallSlider!.y).toBeGreaterThan(aftertaste!.y); // Overall is under the attributes

  // Results: the three tiles are one row, with no orphan, inside the card.
  const tiles = await page
    .getByLabel('Extraction', { exact: true })
    .locator('> div')
    .evaluateAll((els) =>
      els.map((e) => ({
        top: Math.round(e.getBoundingClientRect().top),
        right: e.getBoundingClientRect().right,
      })),
    );
  expect(tiles).toHaveLength(3);
  expect(new Set(tiles.map((t) => t.top)).size).toBe(1);
  expect(Math.max(...tiles.map((t) => t.right))).toBeLessThanOrEqual(bResults!.x + bResults!.width);

  // Setup: the recipe name and version chip share a line; the chips are one size.
  const name = await page.getByText('Morning V60', { exact: true }).first().boundingBox();
  const version = await setup!.getByText('v1', { exact: true }).boundingBox();
  expect(Math.abs(name!.y + name!.height / 2 - (version!.y + version!.height / 2))).toBeLessThan(
    12,
  );
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
  expect(
    (await page.getByRole('img', { name: /^Taste\./ }).boundingBox())!.width,
  ).toBeGreaterThanOrEqual(320);
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
  await page
    .getByRole('dialog', { name: 'Brew this recipe' })
    .getByRole('button', { name: 'Guided timer' })
    .click();
  await page.waitForURL('**/brew?session=*');
  await expect(page.getByRole('button', { name: /^Start/ })).toBeVisible();
  const column = await page.locator('main > div').first().boundingBox();
  expect(column!.width).toBeLessThanOrEqual(16 * 40 + 1);
  expect(Math.abs(column!.x + column!.width / 2 - WIDE / 2)).toBeLessThan(2);
  await noSidewaysScroll(page);
});

/** Every tile's text fits inside the tile, and each tile fits inside its card. */
async function expectTilesFit(page: Page) {
  const problems = await page.locator('dl[aria-label^="Extraction"]').evaluate((panel) => {
    const out: string[] = [];
    const card = panel.closest('section')!.getBoundingClientRect();
    for (const tile of Array.from(panel.children)) {
      const rect = tile.getBoundingClientRect();
      if (rect.left < card.left - 0.5 || rect.right > card.right + 0.5)
        out.push('tile outside its card');
      for (const el of Array.from(tile.querySelectorAll('dt, dd, span, p'))) {
        const e = el as HTMLElement;
        if (e.scrollWidth > e.clientWidth + 1) out.push(`"${e.textContent}" overflows its tile`);
        if (el.getBoundingClientRect().right > rect.right + 0.5)
          out.push(`"${el.textContent}" sticks out of its tile`);
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
}

test('Results tiles never cut off or overflow their text, and stack in a narrow container', async ({
  page,
  users,
}) => {
  const user = await signIn(page, users, 'tiles');
  const recipe = await createRecipe(users, user, 'Morning V60', {
    version: { tds_min: 1.3, tds_max: 1.5, ey_min: 19, ey_max: 21 },
  });
  const id = await logBrewRpc(users, user, recipe.v1Id, { beverage_g: 212, tds_pct: 1.4 });
  for (const url of [`/brews/${id}`, `/brews/${id}/edit`]) {
    for (const width of [WIDE, PHONE]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await waitForApp(page);
      await expect(page.getByLabel(/^Extraction/)).toBeVisible();
      await expectTilesFit(page);
      await noSidewaysScroll(page);
    }
  }

  // A narrow container (the page shell squeezed to 20rem) stacks the tiles instead of overflowing.
  await page.setViewportSize({ width: WIDE, height: 900 });
  await page.goto(`/brews/${id}`);
  await waitForApp(page);
  await page.addStyleTag({ content: '[data-page-width] { max-width: 20rem !important; }' });
  await expect(page.getByLabel(/^Extraction/)).toBeVisible();
  const tops = await page
    .getByLabel(/^Extraction/)
    .locator('> div')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(3); // stacked, one under another
  await expectTilesFit(page);
  const cards = await page.locator('section[aria-labelledby]').evaluateAll((els) =>
    els.map((e) => ({
      left: e.getBoundingClientRect().left,
      right: e.getBoundingClientRect().right,
      top: Math.round(e.getBoundingClientRect().top),
    })),
  );
  expect(new Set(cards.map((c) => c.top)).size).toBe(cards.length); // one card per row: they stack too
  const shell = (await page.locator('[data-page-width]').first().boundingBox())!;
  for (const c of cards) expect(c.right).toBeLessThanOrEqual(shell.x + shell.width + 1);
});
