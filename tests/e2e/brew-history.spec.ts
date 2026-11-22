import { execFileSync } from 'node:child_process';
import { expectNoAxeViolations } from './helpers/axe';
import { baseVersion, createRecipe, saveNextVersion } from './helpers/recipes';
import {
  expect,
  signIn,
  test,
  waitForApp,
  type TestUser,
  type TestUsers,
} from './helpers/test-users';

// Brew history: counts, My brews on the recipe page, /brews, compare and Home. Needs the staging
// secret key (skips without it). Metric units (en-GB).
test.use({ serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London' });

/** Logs brews through `log_brew` with one signed-in client (so a long run doesn't sign in over and over). */
async function brewer(users: TestUsers, user: TestUser) {
  const client = await users.clientFor(user);
  return async (versionId: string, over: Record<string, unknown> = {}) => {
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
        flavours: ['peach'],
        drawdown_s: 172,
        ...over,
      } as never,
    });
    expect(error).toBeNull();
    return (data as { id: string }).id;
  };
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

test('counts: the recipe header, the versions page, and the recipes list with a real last-brewed sort', async ({
  page,
  users,
}) => {
  const user = await signIn(page, users, 'hist-counts');
  const log = await brewer(users, user);
  const older = await createRecipe(users, user, 'Older recipe');
  const brewedNow = await createRecipe(users, user, 'Brewed now');
  const never = await createRecipe(users, user, 'Never brewed');
  // "Older recipe" was edited after its only brew, which was two days ago; "Brewed now" was brewed a
  // moment ago; "Never brewed" was edited last. The list sorts by the brew dates, not the edit dates.
  await log(older.v1Id, { brewed_at: minutesAgo(2 * 24 * 60) });
  await log(brewedNow.v1Id, { brewed_at: new Date(Date.now() + 120_000).toISOString() }); // ahead of any clock skew with the database (up to 5 min is allowed)
  await saveNextVersion(
    users,
    user,
    brewedNow,
    baseVersion({ temp_c: 92, change_note: 'cooler' }),
    'Brewed now',
  );
  const { data: v2 } = await users.admin
    .from('recipe_versions')
    .select('id')
    .eq('recipe_id', brewedNow.id)
    .eq('version_no', 2)
    .single();
  await log(v2!.id as string, { brewed_at: minutesAgo(30) });
  await log(brewedNow.v1Id, { brewed_at: minutesAgo(40) });

  // The recipes list: counts and the order.
  await page.goto('/recipes');
  await waitForApp(page);
  const rowFor = (name: string) =>
    page.getByRole('list', { name: 'Recipes' }).getByRole('listitem').filter({ hasText: name });
  const y = async (name: string) => (await rowFor(name).first().boundingBox())!.y;
  // Brewed a moment ago, then the one edited last, then the one whose only brew is two days old.
  const [yNow, yNever, yOlder] = [
    await y('Brewed now'),
    await y('Never brewed'),
    await y('Older recipe'),
  ];
  expect(yNow).toBeLessThan(yNever);
  expect(yNever).toBeLessThan(yOlder);
  const row = (name: string) =>
    page.getByRole('list', { name: 'Recipes' }).getByRole('listitem').filter({ hasText: name });
  await expect(row('Brewed now')).toContainText('Brewed 3×');
  await expect(row('Older recipe')).toContainText('Brewed 1×');
  await expect(row('Never brewed')).toContainText('Not brewed yet');
  void never;

  // The recipe page header and the versions page.
  await page.goto(`/@${user.handle}/${brewedNow.slug}`);
  await waitForApp(page);
  await expect(page.getByText('3 brews', { exact: false }).first()).toBeVisible();
  await page.goto(`/@${user.handle}/${brewedNow.slug}/versions`);
  await waitForApp(page);
  const items = page.getByRole('list', { name: 'Versions, newest first' }).getByRole('listitem');
  await expect(items.filter({ hasText: 'v2' })).toContainText('1 brew');
  await expect(items.filter({ hasText: 'v1' })).toContainText('2 brews');
});

test('My brews on the recipe page: this version, All versions, ticking to compare', async ({
  page,
  users,
}) => {
  const user = await signIn(page, users, 'hist-mine');
  const log = await brewer(users, user);
  const recipe = await createRecipe(users, user, 'Morning V60');
  for (let i = 0; i < 4; i++)
    await log(recipe.v1Id, { brewed_at: minutesAgo(10 + i), overall: 6 + i });
  await saveNextVersion(users, user, recipe, baseVersion({ temp_c: 92, change_note: 'cooler' }));
  const { data: v2 } = await users.admin
    .from('recipe_versions')
    .select('id')
    .eq('recipe_id', recipe.id)
    .eq('version_no', 2)
    .single();

  // v2 has no brews yet: the empty state offers to brew it.
  await page.goto(`/@${user.handle}/${recipe.slug}`);
  await waitForApp(page);
  const mine = page.getByRole('region', { name: 'My brews' });
  await expect(mine.getByText('No brews of this version yet.')).toBeVisible();
  await expect(mine.getByRole('button', { name: 'Brew this version' })).toBeVisible();

  // v1: its four brews, newest first, the overall score as the headline.
  await page.goto(`/@${user.handle}/${recipe.slug}/v/1`);
  await waitForApp(page);
  const rows = page
    .getByRole('region', { name: 'My brews' })
    .getByRole('list', { name: 'Brews' })
    .getByRole('listitem');
  await expect(rows).toHaveCount(4);
  await expect(rows.first()).toContainText('6.0 overall');
  await page.getByRole('switch', { name: 'All versions' }).click({ force: true });
  await expect(rows).toHaveCount(4);

  // Tick two: the Compare link appears; a third is allowed, a fourth is not.
  const box = (i: number) => rows.nth(i).getByRole('checkbox');
  // The checkbox input is visually hidden; a tap lands on its label.
  const tick = (i: number) => rows.nth(i).locator('label').click();
  await expect(page.getByRole('button', { name: 'Compare' })).toBeDisabled();
  await tick(0);
  await tick(1);
  const compare = page.getByRole('link', { name: 'Compare 2 brews' });
  await expect(compare).toBeVisible();
  await tick(2);
  await expect(page.getByRole('link', { name: 'Compare 3 brews' })).toBeVisible();
  await expect(box(3)).toBeDisabled();
  await expectNoAxeViolations(page);
  await page.getByRole('link', { name: 'Compare 3 brews' }).click();
  await page.waitForURL(/\/brews\/compare\?ids=/);
  expect(new URL(page.url()).searchParams.get('ids')!.split(',')).toHaveLength(3);
  void v2;
});

test('/brews: 30 at a time with Load more, the overall score first, and ticking to compare', async ({
  page,
  users,
}) => {
  test.slow();
  const user = await signIn(page, users, 'hist-all');
  const log = await brewer(users, user);
  const recipe = await createRecipe(users, user, 'Morning V60');
  // 31 brews, newest first: the 31st is on the second page.
  for (let batch = 0; batch < 31; batch += 8) {
    await Promise.all(
      Array.from({ length: Math.min(8, 31 - batch) }, (_, k) =>
        log(recipe.v1Id, {
          brewed_at: minutesAgo(10 + batch + k),
          overall: 5 + ((batch + k) % 10) / 2,
        }),
      ),
    );
  }
  await page.goto('/brews');
  await waitForApp(page);
  const rows = page.getByRole('list', { name: 'Brews' }).getByRole('listitem');
  await expect(rows).toHaveCount(30);
  await expect(page.getByRole('button', { name: 'Load more' })).toBeVisible();
  await expect(rows.first()).toContainText('Morning V60 v1');
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(rows).toHaveCount(31);
  await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test('/brews is empty before the first brew', async ({ page, users }) => {
  await signIn(page, users, 'hist-empty');
  await page.goto('/brews');
  await expect(page.getByText('Brews you log appear here.')).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Brews you log appear here.' })
      .getByRole('link', { name: 'Brew' }),
  ).toBeVisible();
});

test('compare: a 7-axis radar, each overall as a headline and a row, and the rows that differ marked', async ({
  page,
  users,
}) => {
  const user = await signIn(page, users, 'hist-compare');
  const log = await brewer(users, user);
  const recipe = await createRecipe(users, user, 'Morning V60');
  const a = await log(recipe.v1Id, { brewed_at: minutesAgo(120) });
  const b = await log(recipe.v1Id, {
    brewed_at: minutesAgo(60),
    overall: 7,
    sweetness: 6,
    acidity: 7.5,
    flavours: ['peach', 'cocoa'],
    drawdown_s: 190,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/brews/compare?ids=${a},${b}`);
  await waitForApp(page);

  // The headline numbers, with letters.
  const headlines = page.getByRole('list', { name: 'Overall scores' }).getByRole('listitem');
  await expect(headlines).toHaveCount(2);
  await expect(headlines.nth(0)).toContainText('8.5');
  await expect(headlines.nth(1)).toContainText('7.0');

  // The radar: seven axes, overall in the text alternative, a legend naming each brew by letter.
  const radar = page.getByRole('img', { name: /^Taste, compared\./ });
  await expect(radar).toBeVisible();
  await expect(radar).toHaveAccessibleName(/seven axes/);
  await expect(radar).toHaveAccessibleName(/A · .*overall 8\.5/);
  await expect(radar).toHaveAccessibleName(/B · .*overall 7\.0/);
  expect((await radar.boundingBox())!.width).toBeGreaterThanOrEqual(320);

  // The table: only the rows with different values are marked "differs", with an icon and the word.
  const table = page.getByRole('table');
  const marked = async (label: string) =>
    (await table
      .getByRole('row')
      .filter({ has: page.getByRole('rowheader', { name: new RegExp(`^${label}`) }) })
      .getByText('differs')
      .count()) > 0;
  expect(await marked('Overall')).toBe(true);
  expect(await marked('Sweetness')).toBe(true);
  expect(await marked('Flavours')).toBe(true);
  expect(await marked('Drawdown')).toBe(true);
  expect(await marked('Recipe')).toBe(false);
  expect(await marked('Dose')).toBe(false);
  // Overall has a row of its own, after the seven attributes.
  await expect(
    table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /^Overall/ }) }),
  ).toContainText('8.5');
  await expectNoAxeViolations(page);

  // The two cards of the row share a top and a height.
  const cards = await page.locator('section[aria-labelledby^="c-"]').evaluateAll((els) =>
    els.map((e) => ({
      top: Math.round(e.getBoundingClientRect().top),
      bottom: Math.round(e.getBoundingClientRect().bottom),
    })),
  );
  expect(cards).toHaveLength(2);
  expect(cards[0]).toEqual(cards[1]);

  // A phone: no table to cut off. The rows are stacked, one line per brew, differing rows marked.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('table')).toBeHidden();
  const stacked = page.locator('dl[data-differs]').first();
  await expect(stacked).toBeVisible();
  await expect(stacked).toContainText('differs');
  await expect(stacked.locator('dd').first()).toContainText('A');
  await expect(stacked.locator('dd').nth(1)).toContainText('B');
  // The chart resizes a moment after the window does, so wait for the page to settle.
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(0);
  await expectNoAxeViolations(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  // Fewer than two valid ids, or ids that aren't mine, say so.
  await page.goto(`/brews/compare?ids=${a}`);
  await expect(page.getByText('Pick 2 or 3 brews to compare.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'All brews' })).toBeVisible();
  await page.goto(`/brews/compare?ids=${a},00000000-0000-4000-8000-000000000000`);
  await expect(page.getByText('Pick 2 or 3 brews to compare.')).toBeVisible();
});

test('brew detail: Compare starts a selection on /brews', async ({ page, users }) => {
  const user = await signIn(page, users, 'hist-detail');
  const log = await brewer(users, user);
  const recipe = await createRecipe(users, user, 'Morning V60');
  const first = await log(recipe.v1Id);
  await log(recipe.v1Id, { brewed_at: minutesAgo(90), overall: 7 });
  await page.goto(`/brews/${first}`);
  await waitForApp(page);
  await page.getByRole('link', { name: 'Compare' }).click();
  await page.waitForURL(/\/brews\?select=/);
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(1);
  await page
    .locator('label')
    .filter({ has: page.getByRole('checkbox', { checked: false }) })
    .first()
    .click();
  await expect(page.getByRole('link', { name: 'Compare 2 brews' })).toBeVisible();
});

test('Home: the empty state first, then Continue (Brew again opens the sheet) and the 5 recent brews', async ({
  page,
  users,
}) => {
  const user = await signIn(page, users, 'hist-home');
  await page.goto('/home');
  await waitForApp(page);
  await expect(page.getByText('Your brew bar is empty')).toBeVisible();

  const log = await brewer(users, user);
  const recipe = await createRecipe(users, user, 'Morning V60');
  for (let i = 0; i < 6; i++)
    await log(recipe.v1Id, { brewed_at: minutesAgo(10 + i), overall: 5 + i * 0.5 });
  await page.goto('/home');
  await waitForApp(page);
  await expect(page.getByText('Your brew bar is empty')).toHaveCount(0);

  const cont = page.getByRole('region', { name: 'Continue' });
  await expect(cont).toContainText('Morning V60 · v1');
  const recent = page.getByRole('region', { name: 'Recent brews' });
  await expect(
    recent.getByRole('list', { name: 'Recent brews' }).getByRole('listitem'),
  ).toHaveCount(5);
  await expect(recent.getByRole('listitem').first()).toContainText('5.0 overall');
  await expectNoAxeViolations(page);

  await cont.getByRole('link', { name: 'Brew again' }).click();
  await expect(page.getByRole('dialog', { name: 'Brew this recipe' })).toBeVisible();
  await page.goto('/home');
  await page.getByRole('link', { name: 'See all' }).click();
  await page.waitForURL('**/brews');
});

test('scripts/seed-brew.mjs --count --scored seeds history that lists and compares', async ({
  page,
  users,
}) => {
  test.slow();
  const user = await signIn(page, users, 'hist-seed');
  const recipe = await createRecipe(users, user, 'Morning V60');
  const out = execFileSync(
    process.execPath,
    [
      'scripts/seed-brew.mjs',
      '--handle',
      user.handle,
      '--slug',
      recipe.slug,
      '--version',
      '1',
      '--count',
      '4',
      '--scored',
    ],
    { encoding: 'utf8', env: process.env },
  );
  expect(out).toContain('Seeded 4 scored brews');
  const seeded = await users.admin
    .from('brews')
    .select('*')
    .eq('user_id', user.id)
    .order('brewed_at', { ascending: false });
  expect(seeded.data).toHaveLength(4);
  for (const row of seeded.data ?? []) {
    for (const key of [
      'sweetness',
      'acidity',
      'brightness',
      'body',
      'clarity',
      'balance',
      'aftertaste',
      'overall',
    ]) {
      expect(row[key], key).not.toBeNull();
    }
    expect(row.flavours.length).toBeGreaterThan(0);
    expect(row.ey_pct).not.toBeNull();
  }
  expect(new Set((seeded.data ?? []).map((r) => r.overall)).size).toBeGreaterThan(1);
  await page.goto('/brews');
  await waitForApp(page);
  await expect(page.getByRole('list', { name: 'Brews' }).getByRole('listitem')).toHaveCount(4);
  const ids = (seeded.data ?? []).slice(0, 3).map((r) => r.id as string);
  await page.goto(`/brews/compare?ids=${ids.join(',')}`);
  await waitForApp(page);
  await expect(
    page.getByRole('list', { name: 'Overall scores' }).getByRole('listitem'),
  ).toHaveCount(3);
});
