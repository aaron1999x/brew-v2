import { expectNoAxeViolations } from './helpers/axe';
import {
  dismissMissed,
  expectClock,
  openPrep,
  pauseClockSoon,
  stubDevice,
  VARIED,
} from './helpers/brew-device';
import { createRecipe } from './helpers/recipes';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

// The guided timer, the long steep and the stopwatch, on the V60 fixture and other methods, laid out
// like the prototype's Timer page. Uses the staging secret key from the runner's environment and
// skips without it. `page.clock` drives the timer; wake lock and Web Audio are stubbed so beeps and
// the lock can be counted. Metric units (en-GB) keep the numbers simple.
test.use({ serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London' });

test.beforeEach(async ({ page }) => {
  await stubDevice(page);
});

test.describe('choosing what to brew', () => {
  test('the picker lists my recipes, searches them and opens the choice sheet', async ({ page, users }) => {
    const user = await signIn(page, users, 'picker');
    await createRecipe(users, user, 'Morning V60');
    await createRecipe(users, user, 'Evening Press', { method: 'french_press' });
    await page.goto('/brew');
    await waitForApp(page);
    await expect(page.getByRole('button', { name: /Morning V60/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Evening Press/ })).toBeVisible();
    await expect(page.getByText('Not brewed yet').first()).toBeVisible();

    await page.getByLabel('Search your recipes').fill('press');
    await expect(page.getByRole('button', { name: /Morning V60/ })).toHaveCount(0);
    await page.getByLabel('Search your recipes').fill('zzz');
    await expect(page.getByText('No recipes match')).toBeVisible();
    await page.getByLabel('Search your recipes').fill('morning');

    await page.getByRole('button', { name: /Morning V60/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Brew this recipe' });
    await expect(sheet.getByText('Morning V60')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Guided timer' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Log only' })).toBeVisible();
  });

  test('a new account is told to create a recipe first', async ({ page, users }) => {
    await signIn(page, users, 'picker-empty');
    await page.goto('/brew');
    await expect(page.getByText('Create a recipe first, then brew it here.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'New recipe' })).toBeVisible();
  });

  test('"Brew this version" on the recipe page opens the same sheet', async ({ page, users }) => {
    const user = await signIn(page, users, 'recipe-brew');
    const recipe = await createRecipe(users, user);
    await page.goto(`/@${user.handle}/${recipe.slug}`);
    await waitForApp(page);
    await page.getByRole('button', { name: 'Brew this version' }).click();
    await expect(page.getByRole('dialog', { name: 'Brew this recipe' })).toBeVisible();
  });

  test('a timer link without a session goes back to the choice sheet', async ({ page, users }) => {
    const user = await signIn(page, users, 'no-session');
    const recipe = await createRecipe(users, user);
    await page.goto(`/@${user.handle}/${recipe.slug}/v/1/brew?session=00000000-0000-4000-8000-000000000000`);
    await expect(page.getByRole('dialog', { name: 'Brew this recipe' })).toBeVisible();
    await expect(page).toHaveURL(/\?brew=1/);
  });
});

test.describe('the prep screen (Ready)', () => {
  test('shows the total time as a clock, the steps as chips, a one-line summary and the help line', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'prep');
    const recipe = await createRecipe(users, user, 'Morning V60', {
      version: { gear: { brewer: { name: 'Hario V60 02' }, grinder: { name: 'Comandante C40' } } },
    });
    await openPrep(page, user, recipe.slug);
    await expect(page.getByRole('heading', { level: 1, name: /Morning V60/ })).toBeVisible();

    // The total time is a big clock, labelled "Ready".
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    await expectClock(page, '1:30');
    // Two rows: dose, water, ratio; then temperature, the grind SETTING and the grinder's name.
    const rows = page.locator('[class*="summaryRow"]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('[class*="summaryItem"]')).toHaveText(['15 g', '250 g', '1:16.7']);
    await expect(rows.nth(1).locator('[class*="summaryItem"]')).toHaveText([
      '93 °C',
      'Grind 24 clicks',
      'Comandante C40',
    ]);
    // Steps as compact chips: time and the scale weight; a swirl by name.
    const chips = page.getByRole('list', { name: 'Steps' });
    await expect(chips.getByRole('listitem')).toHaveCount(4);
    await expect(chips.getByRole('listitem').first()).toContainText('0:00');
    await expect(chips.getByRole('listitem').first()).toContainText('30 g');
    await expect(chips.getByRole('listitem').nth(1)).toContainText('Swirl');
    // The prototype's one-line help.
    await expect(
      page.getByText(
        '5 s count-in before the brew clock. Beeps 5 s before each pour (a soft pip for other steps). Screen stays awake while running.',
      ),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('shows varied temperatures on the chips, and a Sound on / Sound off pill in the top bar', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'prep-varied');
    const recipe = await createRecipe(users, user, 'Varied', { version: VARIED });
    await openPrep(page, user, recipe.slug);
    await expect(page.getByRole('heading', { name: /Steps · temperature varies by pour/ })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: '40 g' })).toContainText('65 °C');
    await expect(page.getByRole('listitem').filter({ hasText: '100 g' })).toContainText('92 °C');

    // The pill is a toggle button, a full 44 px tall to tap, in the bar with the title.
    const pill = page.getByRole('button', { name: 'Sound on' });
    await expect(pill).toHaveAttribute('aria-pressed', 'true');
    const box = (await pill.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    expect(Math.abs(box.y + box.height / 2 - (title.y + title.height / 2))).toBeLessThan(box.height);
    await pill.click();
    await expect(page.getByRole('button', { name: 'Sound off' })).toHaveAttribute('aria-pressed', 'false');
    // It is remembered on this device, and the old switch is gone.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sound off' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Sound' })).toHaveCount(0);
  });

  test('the step chips share the width equally, and scroll with a hint when there are too many', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'prep-chips');
    const few = await createRecipe(users, user, 'Few steps');
    await openPrep(page, user, few.slug);
    const row = page.getByRole('list', { name: 'Steps' });
    const widths = await row.getByRole('listitem').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
    expect(widths).toHaveLength(4);
    for (const w of widths) expect(Math.abs(w - widths[0]!)).toBeLessThan(1);
    // They fill the row: no gap on the right.
    const rowBox = (await row.boundingBox())!;
    const last = (await row.getByRole('listitem').last().boundingBox())!;
    expect(rowBox.x + rowBox.width - (last.x + last.width)).toBeLessThan(12);
    await expect(row).toHaveAttribute('data-after', 'false');

    const many = await createRecipe(users, user, 'Many steps', {
      version: {
        steps: Array.from({ length: 12 }, (_, i) =>
          i % 3 === 2
            ? { id: `s${i}`, kind: 'swirl', at_s: i * 10, duration_s: 5 }
            : { id: `s${i}`, kind: 'pour', at_s: i * 10, target_g: 20 * (i + 1) },
        ),
        brew_water_g: 250,
      },
    });
    await openPrep(page, user, many.slug);
    const long = page.getByRole('list', { name: 'Steps' });
    await expect(long).toHaveAttribute('data-after', 'true');
    await expect(long).toHaveAttribute('data-before', 'false');
    expect(await long.evaluate((el) => getComputedStyle(el).scrollSnapType)).toContain('x');
    expect(await long.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    // Scrollable by keyboard once it overflows, and the hint moves to the other edge at the end.
    await expect(long).toHaveAttribute('tabindex', '0');
    await long.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await expect(long).toHaveAttribute('data-after', 'false');
    await expect(long).toHaveAttribute('data-before', 'true');
  });

  test('"Change for this brew" previews the new version, and Reset puts it back', async ({ page, users }) => {
    const user = await signIn(page, users, 'prep-change');
    const recipe = await createRecipe(users, user);
    await openPrep(page, user, recipe.slug);

    const panel = page.getByRole('button', { name: /Change for this brew/ });
    await expect(panel).toHaveAttribute('aria-expanded', 'false');
    await panel.click();
    await expect(panel).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('No change. This brew uses the version as it is.')).toBeVisible();

    await page.getByLabel('Grind setting').fill('22 clicks');
    const temperature = page.getByLabel('Temperature');
    await temperature.fill('94');
    await temperature.blur();
    await expect(page.getByText('Grind 24 clicks → 22 clicks · 93 → 94 °C')).toBeVisible();
    await expect(page.getByText('Saves as v2 when you log this brew.')).toBeVisible();
    await expect(page.getByText('Changed', { exact: true })).toBeVisible();
    // The summary line follows the change.
    await expect(page.getByText(/94 °C \(changed, was 93 °C\)/)).toBeVisible();
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByText('No change. This brew uses the version as it is.')).toBeVisible();
    await expect(page.getByLabel('Grind setting')).toHaveValue('24 clicks');
  });
});

test.describe('the guided timer', () => {
  test('counts in on one big card, then runs a flip clock', async ({ page, users }) => {
    const user = await signIn(page, users, 'guided');
    const recipe = await createRecipe(users, user, 'Varied', { version: VARIED });
    await page.clock.install();
    await openPrep(page, user, recipe.slug);
    await pauseClockSoon(page);

    await page.getByRole('button', { name: 'Start', exact: true }).click();
    // The count-in: a big number card showing the first step, and "Skip · start now".
    await expect(page.getByText('Get ready · brew clock starts in')).toBeVisible();
    await expect(page.getByText('Bloom → 40 g · 65 °C')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip · start now' })).toBeVisible();
    await expect(page.getByRole('timer')).toHaveCount(0);

    await page.clock.runFor(5200);
    await expectClock(page, '0:00');
    expect(await page.evaluate(() => window.__wakeRequests)).toBeGreaterThan(0);
    // Count-in ticks at 5, 4, 3, 2, 1 and two beeps for the start. The wait at 0:05 would warn
    // 5 s before it, which is the start itself; it plays as the quiet pip at 0:00 with the start beep.
    expect(await page.evaluate(() => window.__beeps)).toEqual([880, 880, 880, 880, 880, 990, 990, 1480]);
  });

  test('one focus card says what is on the scale, what is next, the next weight and the kettle', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'focus');
    const recipe = await createRecipe(users, user, 'Varied', { version: VARIED });
    await page.clock.install();
    await openPrep(page, user, recipe.slug);
    await pauseClockSoon(page);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.clock.runFor(5200);

    // Straight after the bloom pour starts.
    const card = page.getByLabel('Current step');
    await expect(card).toContainText('On scale 40 g · kettle 65 °C');
    await expect(card).toContainText('Next: Wait at 0:05');
    await expect(page.getByLabel('Next step')).toHaveCount(0); // one card, not two

    // During the wait.
    await page.clock.fastForward(20_000);
    await page.clock.runFor(150);
    await dismissMissed(page);
    await expect(card).toContainText('Wait · scale stays at 40 g · 0:15 left');
    await expect(card).toContainText('Next pour at 0:40 · Centre spiral');
    await expect(card).toContainText('100');
    await expect(card).toContainText('+60 g this pour');
    await expect(card).toContainText('Switch kettle → 92 °C');
    await expect(card).toContainText('in 20 s');
    // The status sits in a slim strip at the top of the card, above the next-pour block.
    const strip = card.locator('[class*="statusStrip"]');
    await expect(strip).toHaveText('Wait · scale stays at 40 g · 0:15 left');
    const [stripBox, heroBox] = await Promise.all([strip.boundingBox(), card.locator('[class*="hero"]').first().boundingBox()]);
    expect(stripBox!.y + stripBox!.height).toBeLessThanOrEqual(heroBox!.y);
    // The countdown is the accent colour, and only gets bolder in the last 5 s (the warning beep).
    const countdown = card.getByText(/^in \d+ s$/);
    const weight = () => countdown.evaluate((el) => getComputedStyle(el).fontWeight);
    expect(Number(await weight())).toBeLessThan(800);
    await page.clock.fastForward(17_000);
    await page.clock.runFor(150);
    await expect(card).toContainText('in 3 s');
    expect(Number(await weight())).toBeGreaterThanOrEqual(800);

    // After the last pour: the card says so, and the button is Drawdown done.
    await page.clock.fastForward(60_000);
    await page.clock.runFor(150);
    await dismissMissed(page);
    await expect(card).toContainText('Last pour done');
    await expect(card).toContainText('Target drawdown 2:45–3:15');
    await expect(page.getByRole('button', { name: 'Drawdown done' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'End brew' })).toBeVisible();
  });

  test('beeps for each step, pauses and resumes without counting the pause', async ({ page, users }) => {
    const user = await signIn(page, users, 'guided-beeps');
    const recipe = await createRecipe(users, user);
    await page.clock.install();
    await openPrep(page, user, recipe.slug);
    await pauseClockSoon(page);

    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.clock.runFor(5200);
    await expectClock(page, '0:00');
    expect(await page.evaluate(() => window.__beeps)).toEqual([880, 880, 880, 880, 880, 990, 990]);

    await page.clock.runFor(10_000);
    await expectClock(page, '0:10');
    // The thin progress bar under the clock: elapsed of the whole brew, named for assistive technology.
    const progress = page.getByRole('progressbar', { name: '0:10 of 1:30' });
    await expect(progress).toHaveAttribute('aria-valuenow', '10');
    await expect(progress).toHaveAttribute('aria-valuemax', '90');
    // A soft pip 5 s before the swirl and one at it.
    expect((await page.evaluate(() => window.__beeps)).slice(7)).toEqual([1480, 1480]);
    const card = page.getByLabel('Current step');
    await expect(card).toContainText('Swirl · scale stays at 30 g');
    await expect(card).toContainText('Next pour at 0:45');
    await expect(card).toContainText('150');
    await expect(card).toContainText('+120 g this pour');

    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByText('Paused', { exact: true })).toBeVisible();
    await page.clock.runFor(20_000);
    await expectClock(page, '0:10');

    // The 20 s pause is not counted: 10.2 s + 5 s.
    await page.getByRole('button', { name: 'Resume' }).click();
    await page.clock.runFor(5_000);
    await expectClock(page, '0:15');

    // axe uses timers, so let the clock run again first.
    await page.clock.resume();
    await expectNoAxeViolations(page);
  });

  test('lists the steps that passed while the app was away', async ({ page, users }) => {
    const user = await signIn(page, users, 'missed');
    const recipe = await createRecipe(users, user);
    await page.clock.install();
    await openPrep(page, user, recipe.slug);
    await pauseClockSoon(page);

    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.clock.runFor(5200);
    await page.clock.fastForward(50_000);
    await page.clock.runFor(100);

    const dialog = page.getByRole('alertdialog', { name: 'While you were away' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Swirl at 0:10');
    await expect(dialog).toContainText('Pour to 150 g at 0:45');
    await expectClock(page, '0:50');
    await dialog.getByRole('button', { name: 'Got it' }).click();
    await expect(dialog).toBeHidden();
  });

  test('a pour-over ends with "Drawdown done", which records the time and opens the log', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'drawdown');
    const recipe = await createRecipe(users, user);
    await page.clock.install();
    await openPrep(page, user, recipe.slug);
    await pauseClockSoon(page);

    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.clock.runFor(5200);
    await page.clock.fastForward(90_000);
    await page.clock.runFor(150);
    await dismissMissed(page);
    await expect(page.getByLabel('Current step')).toContainText('Last pour done');
    await expect(page.getByLabel('Current step')).toContainText('Target drawdown 2:45–3:15');
    await page.clock.fastForward(70_000);
    await page.clock.runFor(150);
    await page.getByRole('button', { name: 'Drawdown done' }).click();
    await page.waitForURL('**/brews/new?session=*');

    const timer = await page.evaluate((id) => {
      const raw = localStorage.getItem(`brew-sessions:v1:${id}`);
      return raw ? (JSON.parse(raw)[0].timer as { phase: string; drawdownS: number }) : null;
    }, user.id);
    expect(timer?.phase).toBe('done');
    expect(timer?.drawdownS).toBeGreaterThanOrEqual(159);
    expect(timer?.drawdownS).toBeLessThanOrEqual(162);
  });

  test('a French press ends with "Done", with no drawdown', async ({ page, users }) => {
    const user = await signIn(page, users, 'press');
    const recipe = await createRecipe(users, user, 'Press', {
      method: 'french_press',
      version: {
        steps: [
          { id: 'a', kind: 'pour', at_s: 0, target_g: 250 },
          { id: 'b', kind: 'wait', at_s: 15, duration_s: 240 },
        ],
      },
    });
    await page.clock.install();
    await openPrep(page, user, recipe.slug);
    await pauseClockSoon(page);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.clock.runFor(5200);
    await page.clock.fastForward(256_000);
    await page.clock.runFor(150);
    await dismissMissed(page);
    await expect(page.getByLabel('Current step')).toContainText('All steps done');
    await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Drawdown done' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.waitForURL('**/brews/new?session=*');
    const drawdown = await page.evaluate((id) => {
      const raw = localStorage.getItem(`brew-sessions:v1:${id}`);
      return raw ? JSON.parse(raw)[0].timer.drawdownS : undefined;
    }, user.id);
    expect(drawdown).toBeNull();
  });

  test('End brew can keep brewing, or discard and take nothing with it', async ({ page, users }) => {
    const user = await signIn(page, users, 'end');
    const recipe = await createRecipe(users, user);
    await openPrep(page, user, recipe.slug);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByRole('button', { name: 'End brew' })).toBeVisible();
    await page.getByRole('button', { name: 'End brew' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'End this brew?' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('[data-entering]')).toHaveCount(0);
    await expectNoAxeViolations(page);
    await dialog.getByRole('button', { name: 'Keep brewing' }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: 'End brew' }).click();
    await dialog.getByRole('button', { name: 'Discard' }).click();
    await page.waitForURL('**/home');
    const left = await page.evaluate((id) => localStorage.getItem(`brew-sessions:v1:${id}`), user.id);
    expect(JSON.parse(left ?? '[]')).toEqual([]);
    // Nothing was written to the database, so nothing locked the version.
    const { data } = await users.admin
      .from('recipe_versions')
      .select('locked_at')
      .eq('id', recipe.v1Id)
      .single();
    expect(data?.locked_at).toBeNull();
    const { count } = await users.admin
      .from('brews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    expect(count).toBe(0);
  });
});

test.describe('other kinds of brew', () => {
  test('a recipe with no steps runs a stopwatch', async ({ page, users }) => {
    const user = await signIn(page, users, 'stopwatch');
    const recipe = await createRecipe(users, user, 'Open brew', { version: { steps: [] } });
    await page.clock.install();
    await openPrep(page, user, recipe.slug);
    await expect(page.getByText(/no steps, so you.ll get a stopwatch/)).toBeVisible();
    await pauseClockSoon(page);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.clock.runFor(5200 + 3000);
    await expectClock(page, '0:03');
    await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
    await expect(page.getByLabel('Stopwatch')).toBeVisible();
    await expect(page.getByLabel('Next step')).toHaveCount(0);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  });

  test('a cold brew offers "Start steep", with no count-in and no wake lock, and shows on Home', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'steep');
    const recipe = await createRecipe(users, user, 'Cold brew', {
      method: 'cold_brew',
      version: {
        dose_g: 60,
        brew_water_g: 600,
        steps: [
          { id: 'a', kind: 'pour', at_s: 0, target_g: 600 },
          { id: 'b', kind: 'wait', at_s: 60, duration_s: 43_200 },
        ],
      },
    });
    await openPrep(page, user, recipe.slug);
    await expect(page.getByRole('button', { name: 'Start steep' })).toBeVisible();
    // A steep is h:mm:ss on the Ready clock.
    await expectClock(page, '12:01:00');
    await page.getByRole('button', { name: 'Start steep' }).click();
    await expect(page.getByText('Steeping for', { exact: true })).toBeVisible();
    await expect(page.getByText(/ends at /)).toBeVisible();
    await expect(page.getByText('Get ready')).toHaveCount(0);
    await expect(page.getByRole('timer')).toBeVisible();
    await expect(page.getByLabel('Current step')).toContainText('Next: Wait at');
    expect(await page.evaluate(() => window.__wakeRequests)).toBe(0);
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Back to Home' }).click();
    await page.waitForURL('**/home');
    await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible();
    await expect(page.getByText(/Steeping · ends/)).toBeVisible();
  });
});

test.describe('unfinished brews on Home', () => {
  test('show a running brew and can be discarded', async ({ page, users }) => {
    const user = await signIn(page, users, 'home-card');
    const recipe = await createRecipe(users, user);
    await openPrep(page, user, recipe.slug);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByRole('button', { name: 'End brew' })).toBeVisible();

    await page.goto('/home');
    await waitForApp(page);
    await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible();
    await expect(page.getByText('Brewing · back to the timer')).toBeVisible();
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Actions for Morning V60 v1' }).click();
    await page.getByRole('menuitem', { name: 'Discard' }).click();
    await page
      .getByRole('alertdialog', { name: 'Discard this brew?' })
      .getByRole('button', { name: 'Discard' })
      .click();
    await expect(page.getByRole('heading', { name: 'In progress' })).toHaveCount(0);
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('prep, count-in, running and paused timer screens have no violations', async ({ page, users }) => {
      const user = await signIn(page, users, `a11y-${scheme}`);
      const recipe = await createRecipe(users, user, 'Varied', { version: VARIED });
      await openPrep(page, user, recipe.slug);
      await page.getByRole('button', { name: /Change for this brew/ }).click();
      await expectNoAxeViolations(page);

      await page.getByRole('button', { name: 'Start', exact: true }).click();
      await expect(page.getByLabel('Get ready')).toBeVisible();
      await expectNoAxeViolations(page);

      await page.getByRole('button', { name: 'Skip · start now' }).click();
      await expect(page.getByRole('timer')).toBeVisible();
      await expectNoAxeViolations(page);

      await page.getByRole('button', { name: 'Pause' }).click();
      await expect(page.getByText('Paused', { exact: true })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  });
}
