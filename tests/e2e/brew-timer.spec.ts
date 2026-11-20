import type { Page } from '@playwright/test';
import { expectNoAxeViolations } from './helpers/axe';
import { createRecipe } from './helpers/recipes';
import { expect, signIn, test, waitForApp, type TestUser } from './helpers/test-users';

// The guided timer, the long steep and the stopwatch, on the V60 fixture and three other methods.
// Uses the staging secret key from the runner's environment and skips without it. `page.clock`
// drives the timer; wake lock and Web Audio are stubbed so beeps and the lock can be counted.
// Metric units (en-GB) keep the numbers simple.
test.use({ serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London' });

declare global {
  interface Window {
    __beeps: number[];
    __wakeRequests: number;
  }
}

/** Counts every beep's frequency and every wake lock request. */
async function stubDevice(page: Page) {
  await page.addInitScript(() => {
    window.__beeps = [];
    window.__wakeRequests = 0;
    class FakeAudioContext {
      state = 'suspended';
      currentTime = 0;
      destination = {};
      addEventListener() {}
      async resume() {
        this.state = 'running';
      }
      createBuffer() {
        return {};
      }
      createBufferSource() {
        return { connect() {}, start() {} };
      }
      createGain() {
        const node = {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect: () => node,
        };
        return node;
      }
      createOscillator() {
        const osc = {
          type: '',
          frequency: { value: 0 },
          connect: () => ({ connect() {} }),
          start() {
            window.__beeps.push(osc.frequency.value);
          },
          stop() {},
        };
        return osc;
      }
    }
    Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true });
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          window.__wakeRequests += 1;
          return { release: async () => {}, addEventListener() {} };
        },
      },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await stubDevice(page);
});

/** Opens the recipe's choice sheet and starts a guided timer; lands on the prep screen. */
async function openPrep(page: Page, user: TestUser, slug: string) {
  await page.goto(`/@${user.handle}/${slug}?brew=1`);
  await waitForApp(page);
  const sheet = page.getByRole('dialog', { name: 'Brew this recipe' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Guided timer' }).click();
  await page.waitForURL('**/brew?session=*');
  await expect(page).toHaveTitle(/Brew/);
  await expect(page.getByRole('button', { name: /^Start/ })).toBeVisible();
}

async function pauseClockSoon(page: Page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
}

const clockText = (page: Page) => page.getByRole('timer');

/** Closes the "While you were away" summary that a long jump in time brings up. */
async function dismissMissed(page: Page) {
  const dialog = page.getByRole('alertdialog', { name: 'While you were away' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toBeHidden();
}

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

test.describe('the prep screen', () => {
  test('shows the recipe and a "Change for this brew" panel that previews the new version', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'prep');
    const recipe = await createRecipe(users, user);
    await openPrep(page, user, recipe.slug);
    await expect(page.getByRole('heading', { level: 1, name: /Morning V60/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Steps' })).toBeVisible();
    await expectNoAxeViolations(page);

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
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByText('No change. This brew uses the version as it is.')).toBeVisible();
    await expect(page.getByLabel('Grind setting')).toHaveValue('24 clicks');
  });
});

test.describe('the guided timer', () => {
  test('counts in, runs the clock, beeps for each step, pauses and resumes', async ({ page, users }) => {
    const user = await signIn(page, users, 'guided');
    const recipe = await createRecipe(users, user);
    await page.clock.install();
    await openPrep(page, user, recipe.slug);
    await pauseClockSoon(page);

    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByText('Get ready · brew clock starts in')).toBeVisible();
    await expect(page.getByRole('timer')).toHaveCount(0);
    await page.clock.runFor(5200);
    await expect(clockText(page)).toHaveText('0:00');
    expect(await page.evaluate(() => window.__wakeRequests)).toBeGreaterThan(0);
    // Count-in ticks at 5, 4, 3, 2, 1 and two beeps for the start.
    expect(await page.evaluate(() => window.__beeps)).toEqual([880, 880, 880, 880, 880, 990, 990]);

    await page.clock.runFor(10_000);
    await expect(clockText(page)).toHaveText('0:10');
    // A soft pip 5 s before the swirl and one at it.
    expect((await page.evaluate(() => window.__beeps)).slice(7)).toEqual([1480, 1480]);
    await expect(page.getByLabel('Current step')).toContainText('Swirl');
    await expect(page.getByLabel('Next step')).toContainText('Pour at 0:45');
    await expect(page.getByLabel('Next step')).toContainText('150');

    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByText('Paused', { exact: true })).toBeVisible();
    await page.clock.runFor(20_000);
    await expect(clockText(page)).toHaveText('0:10');

    // The 20 s pause is not counted: 10.2 s + 5 s.
    await page.getByRole('button', { name: 'Resume' }).click();
    await page.clock.runFor(5_000);
    await expect(clockText(page)).toHaveText('0:15');
    await expect(page.getByLabel('Current step')).toContainText('Swirl');

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
    await expect(clockText(page)).toHaveText('0:50');
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
    await expect(page.getByLabel('All steps done')).toBeVisible();
    await expect(page.getByLabel('All steps done')).toContainText('Target drawdown 2:45–3:15');
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
    await expect(clockText(page)).toHaveText('0:03');
    await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
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
    await page.getByRole('button', { name: 'Start steep' }).click();
    await expect(page.getByText('Steeping for')).toBeVisible();
    await expect(page.getByText(/Ends at /)).toBeVisible();
    await expect(page.getByText('Get ready')).toHaveCount(0);
    await expect(page.getByRole('timer')).toBeVisible();
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
    await page.getByRole('alertdialog', { name: 'Discard this brew?' }).getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByRole('heading', { name: 'In progress' })).toHaveCount(0);
  });
});
