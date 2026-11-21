import type { Page } from '@playwright/test';
import { expectNoAxeViolations } from './helpers/axe';
import { stubDevice } from './helpers/brew-device';
import { createRecipe } from './helpers/recipes';
import { expect, logIn, signIn, test, waitForApp, type TestUser } from './helpers/test-users';

// The brew log, detail, edit, delete and "Create next version", from a Log only session. Needs the
// staging secret key (skips without it). Metric units (en-GB) keep the numbers simple.
test.use({ serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London' });

const SUMMARY = '[aria-labelledby="form-error-summary-title"]';
const TARGETS = { tds_min: 1.3, tds_max: 1.5, ey_min: 19, ey_max: 21 };

test.beforeEach(async ({ page }) => {
  await stubDevice(page);
});

/** Opens the choice sheet for a recipe and starts "Log only"; lands on the log form. */
async function openLog(page: Page, user: TestUser, slug: string) {
  await page.goto(`/@${user.handle}/${slug}?brew=1`);
  await waitForApp(page);
  const sheet = page.getByRole('dialog', { name: 'Brew this recipe' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Log only' }).click();
  await page.waitForURL('**/brews/new?session=*');
  await expect(page.getByRole('heading', { level: 1, name: 'Log brew' })).toBeVisible();
  await expect(page).toHaveTitle(/Log brew/);
}

const slider = (page: Page, label: string) => page.getByRole('slider', { name: new RegExp(`^${label}`) });

/** Sets the Overall score with the keyboard: the first arrow gives 5.0, one more 5.5. */
async function scoreOverall(page: Page) {
  const overall = slider(page, 'Overall');
  await overall.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(overall).toHaveAttribute('aria-valuetext', '5.5 out of 10');
}

const notesField = (page: Page) => page.getByRole('textbox', { name: 'Notes', exact: true });
const nextField = (page: Page) => page.getByRole('textbox', { name: /^Next time/ });
const tag = (page: Page, name: string) => page.getByRole('row', { name });

const save = (page: Page) => page.getByRole('button', { name: 'Save', exact: true }).first().click();

test('the cards are in the prototype’s order, and axe passes', async ({ page, users }) => {
  const user = await signIn(page, users, 'log-order');
  const recipe = await createRecipe(users, user, 'Morning V60', { version: TARGETS });
  await openLog(page, user, recipe.slug);

  const headings = await page.getByRole('heading', { level: 2 }).allTextContents();
  expect(headings.filter((h) => !/^Change|^Fix/.test(h))).toEqual([
    'Setup',
    'Results',
    'Sensory',
    'Flavour notes',
    'Notes',
  ]);
  await expect(page.getByLabel('Drawdown')).toBeVisible(); // a pour-over
  // One Drawdown tile, inside Results; no separate Extraction section.
  await expect(page.getByRole('region', { name: 'Results' }).getByText('Target 2:45–3:15')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Extraction' })).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test('attributes start at 5.0; overall starts empty, with no Clear buttons', async ({ page, users }) => {
  const user = await signIn(page, users, 'log-sliders');
  const recipe = await createRecipe(users, user);
  await openLog(page, user, recipe.slug);

  for (const label of ['Sweetness', 'Acidity', 'Brightness', 'Body', 'Clarity', 'Balance', 'Aftertaste']) {
    await expect(slider(page, label)).toHaveAttribute('aria-valuetext', '5.0 out of 10');
  }
  await expect(page.getByRole('button', { name: /^Clear/ })).toHaveCount(0);

  const sweetness = slider(page, 'Sweetness');
  await sweetness.focus();
  await page.keyboard.press('ArrowRight');
  await expect(sweetness).toHaveAttribute('aria-valuetext', '5.5 out of 10');
  await page.keyboard.press('End');
  await expect(sweetness).toHaveAttribute('aria-valuetext', '10.0 out of 10');

  // Overall: empty, the first arrow sets 5.0, Home and End set 0 and 10.
  const overall = slider(page, 'Overall');
  const big = page.getByTestId('overall-score');
  await expect(overall).toHaveAttribute('aria-valuetext', 'not scored');
  await expect(big).toHaveText('Not scored');
  await overall.focus();
  await page.keyboard.press('ArrowUp');
  await expect(overall).toHaveAttribute('aria-valuetext', '5.0 out of 10');
  await expect(big).toHaveText('5.0 / 10');
  await page.keyboard.press('ArrowRight');
  await expect(big).toHaveText('5.5 / 10');

  // The radar shows the seven attributes; its text alternative lists them and overall.
  const chart = page.getByRole('img', { name: /^Taste\./ });
  await expect(chart).toBeVisible();
  await expect(chart).toHaveAccessibleName(/sweetness 10\.0, acidity 5\.0.*aftertaste 5\.0, overall 5\.5/);
  await expect(chart).not.toHaveAccessibleName(/eight axes/);
});

test('saving without overall focuses the summary and links to the slider', async ({ page, users }) => {
  const user = await signIn(page, users, 'log-overall');
  const recipe = await createRecipe(users, user);
  await openLog(page, user, recipe.slug);

  await save(page);
  await expect(page.locator(SUMMARY)).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Fix 1 thing to continue' })).toBeVisible();
  await page.locator(SUMMARY).getByRole('link', { name: 'Score the cup overall before saving' }).click();
  await expect(slider(page, 'Overall')).toBeFocused();
  await expectNoAxeViolations(page);

  const { count } = await users.admin.from('brews').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  expect(count).toBe(0);
});

test('EY and the target flags: in range, below and above', async ({ page, users }) => {
  const user = await signIn(page, users, 'log-ey');
  const recipe = await createRecipe(users, user, 'Morning V60', { version: TARGETS });
  await openLog(page, user, recipe.slug);

  const extraction = page.getByLabel('Extraction', { exact: true });
  await page.getByLabel('Beverage weight').fill('210');
  await page.getByLabel('Beverage weight').blur();
  await page.getByLabel('TDS (%)').fill('1.4');
  // 1.4 × 210 ÷ 15 = 19.6: in range.
  // EY is a tile (three tiles in one row); TDS shows its status directly under its input.
  const results = page.getByRole('region', { name: 'Results', exact: true });
  await expect(extraction).toContainText('19.6%');
  await expect(extraction).toContainText('In range · 19–21%');
  await expect(results).toContainText('In range · 1.3–1.5');

  await page.getByLabel('TDS (%)').fill('1.2'); // 16.8%: below
  await expect(extraction).toContainText('Below · 19–21%');
  await expect(results).toContainText('Below · 1.3–1.5');

  await page.getByLabel('TDS (%)').fill('1.7'); // 23.8%: above
  await expect(extraction).toContainText('Above · 19–21%');
  await expect(results).toContainText('Above · 1.3–1.5');

  // Drawdown (2:45–3:15 target): its status is under the input, too.
  await page.getByLabel('Drawdown').fill('2:00');
  await page.getByLabel('Drawdown').blur();
  await expect(results).toContainText('Below · 2:45–3:15');
});

test('text in a number field is kept and explained when saving', async ({ page, users }) => {
  const user = await signIn(page, users, 'log-typed');
  const recipe = await createRecipe(users, user);
  await openLog(page, user, recipe.slug);
  await scoreOverall(page);

  await page.getByLabel('TDS (%)').pressSequentially('abc');
  await expect(page.getByLabel('TDS (%)')).toHaveValue('abc');
  await save(page);
  const summary = page.locator(SUMMARY);
  await expect(summary).toBeFocused();
  await expect(summary.getByRole('link')).toHaveText(['Use a number, e.g. 1.38']);
  await page.getByLabel('TDS (%)').fill('1.38');
  await save(page);
  await page.waitForURL(/\/brews\/[0-9a-f-]{36}$/);
});

test('log, detail, edit, delete and undo, next version with the pinned note, and privacy', async ({
  page,
  users,
  browser,
}) => {
  test.slow();
  const user = await signIn(page, users, 'log-flow');
  const recipe = await createRecipe(users, user, 'Morning V60', { version: TARGETS });
  await openLog(page, user, recipe.slug);

  await scoreOverall(page);
  await slider(page, 'Sweetness').focus();
  await page.keyboard.press('ArrowRight'); // 5.0 to 5.5
  await tag(page, 'peach').click();
  await page.getByLabel('Add your own').fill('toasted almond');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Warm' }).click();
  await notesField(page).fill('Sweet and clean');
  await nextField(page).fill('Grind a touch finer');
  await page.getByLabel('Beverage weight').fill('210');
  await page.getByLabel('Beverage weight').blur();
  await page.getByLabel('TDS (%)').fill('1.4');
  await save(page);

  // The detail page.
  await page.waitForURL(/\/brews\/[0-9a-f-]{36}$/);
  const id = page.url().split('/').pop()!;
  await expect(page.getByText('Brew saved')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Morning V60');
  await expect(page.getByLabel('Overall score 5.5 out of 10')).toBeVisible();
  await expect(page.getByLabel('Extraction results')).toContainText('19.6%');
  await expect(page.getByText('toasted almond')).toBeVisible();
  await expect(page.getByText('Minutes after brewing')).toHaveCount(0);
  await expect(page.getByLabel('Setup', { exact: true })).toContainText('warm');
  await expect(page.getByText('Grind a touch finer')).toBeVisible();
  await expect(page.getByRole('img', { name: /^Pour curve\./ })).toBeVisible();

  const { data: row } = await users.admin.from('brews').select('*').eq('id', id).single();
  expect(row).toMatchObject({ overall: 5.5, sweetness: 5.5, acidity: 5, brightness: 5, body: 5, clarity: 5, balance: 5, aftertaste: 5, source: 'manual', ey_pct: 19.6 });
  expect(row?.flavours).toEqual(['peach', 'toasted almond']);
  const { data: version } = await users.admin.from('recipe_versions').select('locked_at').eq('id', recipe.v1Id).single();
  expect(version?.locked_at).not.toBeNull();
  await expectNoAxeViolations(page);

  // The session is gone from the device.
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('brew-sessions')).map((k) => localStorage.getItem(k)))).toEqual(['[]']);

  // Edit.
  await page.getByRole('button', { name: 'More actions for this brew' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await page.waitForURL(`**/brews/${id}/edit`);
  await expect(page.getByRole('heading', { level: 1, name: 'Edit brew' })).toBeVisible();
  await expect(notesField(page)).toHaveValue('Sweet and clean');
  await notesField(page).fill('Sweet, clean and floral');
  await save(page);
  await page.waitForURL(`**/brews/${id}`);
  await expect(page.getByText('Sweet, clean and floral')).toBeVisible();

  // Create next version: the editor shows what the brew said to change, pinned.
  await page.getByRole('link', { name: 'Create next version' }).click();
  await page.waitForURL('**/new-version?from=1&brew=*');
  const pinned = page.getByRole('complementary', { name: 'Note from your brew' });
  await expect(pinned).toContainText('Grind a touch finer');
  await expect(pinned).toContainText('overall 5.5');
  await pinned.getByRole('button', { name: 'Dismiss this note' }).click();
  await expect(pinned).toHaveCount(0);

  // Another member gets the same "not available" page for this brew, and nothing of it.
  const other = await users.create('log-other');
  const otherPage = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
  await logIn(otherPage, other);
  const response = await otherPage.goto(`/brews/${id}`);
  expect(response?.status()).toBe(404);
  await expect(otherPage.getByText("This page isn't available")).toBeVisible();
  const editResponse = await otherPage.goto(`/brews/${id}/edit`);
  expect(editResponse?.status()).toBe(404);
  await otherPage.context().close();

  // Delete with undo; the version stays locked.
  await page.goto(`/brews/${id}`);
  await page.getByRole('button', { name: 'More actions for this brew' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete this brew?' });
  await expect(dialog).toContainText('The version stays locked.');
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Brew deleted')).toBeVisible();
  const gone = await users.admin.from('brews').select('deleted_at').eq('id', id).single();
  expect(gone.data?.deleted_at).not.toBeNull();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Brew restored')).toBeVisible();
  await page.waitForURL(`**/brews/${id}`);
  const back = await users.admin.from('brews').select('deleted_at').eq('id', id).single();
  expect(back.data?.deleted_at).toBeNull();

  await page.getByRole('button', { name: 'More actions for this brew' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Brew deleted')).toBeVisible();
  const still = await users.admin.from('recipe_versions').select('locked_at').eq('id', recipe.v1Id).single();
  expect(still.data?.locked_at).not.toBeNull();
  const deleted = await page.goto(`/brews/${id}`);
  expect(deleted?.status()).toBe(404);
});

test('a quick change saves as the next version with its change note, once', async ({ page, users }) => {
  const user = await signIn(page, users, 'log-quick');
  const recipe = await createRecipe(users, user, 'Morning V60');
  await openLog(page, user, recipe.slug);

  await page.getByRole('button', { name: 'Brewed with a change?' }).click();
  await page.getByLabel('Grind setting', { exact: true }).fill('22 clicks');
  await expect(page.getByText('Saves as v2 when you log this brew.').first()).toBeVisible();
  await expect(page.getByText('Changed: grind 24 clicks → 22 clicks')).toBeVisible();
  await scoreOverall(page);
  await save(page);

  await page.waitForURL(/\/brews\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Brew saved as v2')).toBeVisible();
  await expect(page.getByText('Brewed with changes: grind 24 clicks → 22 clicks').first()).toBeVisible();
  const id = page.url().split('/').pop()!;
  const { data: brew } = await users.admin.from('brews').select('version_no_snapshot, recipe_version_id').eq('id', id).single();
  expect(brew?.version_no_snapshot).toBe(2);
  const { data: versions } = await users.admin
    .from('recipe_versions')
    .select('version_no, grind_setting, change_note, locked_at')
    .eq('recipe_id', recipe.id)
    .order('version_no');
  expect(versions).toHaveLength(2);
  expect(versions?.[0]).toMatchObject({ grind_setting: '24 clicks' });
  expect(versions?.[1]).toMatchObject({
    grind_setting: '22 clicks',
    change_note: 'Brewed with changes: grind 24 clicks → 22 clicks',
  });
  expect(versions?.[1]?.locked_at).not.toBeNull();
});

test('the draft comes back after a reload, and Keep leaves the session on Home', async ({ page, users }) => {
  const user = await signIn(page, users, 'log-draft');
  const recipe = await createRecipe(users, user);
  await openLog(page, user, recipe.slug);

  await notesField(page).fill('half done');
  await slider(page, 'Body').focus();
  await page.keyboard.press('ArrowRight');
  await tag(page, 'cocoa').click();
  // The draft is kept shortly after the last change.
  await expect.poll(() =>
    page.evaluate(() => Object.values(localStorage).some((v) => v.includes('half done'))),
  ).toBe(true);

  await page.reload();
  await waitForApp(page);
  await expect(notesField(page)).toHaveValue('half done');
  await expect(slider(page, 'Body')).toHaveAttribute('aria-valuetext', '5.5 out of 10');
  await expect(tag(page, 'cocoa')).toHaveAttribute('aria-selected', 'true');

  // Cancel asks; Keep goes Home where the brew is waiting.
  await page.getByRole('button', { name: 'Cancel' }).click();
  const sheet = page.getByRole('dialog', { name: 'Keep this brew for later?' });
  await sheet.getByRole('button', { name: 'Back to log' }).click();
  await expect(sheet).toBeHidden();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('dialog', { name: 'Keep this brew for later?' }).getByRole('button', { name: 'Keep' }).click();
  await page.waitForURL('**/home');
  await expect(page.getByText('Finish logging').first()).toBeVisible();

  // Discard (with its confirm) removes it and creates nothing.
  await page.getByRole('link', { name: /Finish logging/ }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('dialog', { name: 'Keep this brew for later?' }).getByRole('button', { name: 'Discard' }).click();
  await page.getByRole('alertdialog', { name: 'Discard this brew?' }).getByRole('button', { name: 'Discard' }).click();
  await page.waitForURL('**/home');
  await expect(page.getByText('Finish logging')).toHaveCount(0);
  const { count } = await users.admin.from('brews').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  expect(count).toBe(0);
});

test('saving offline keeps the form and says why', async ({ page, users, context }) => {
  const user = await signIn(page, users, 'log-offline');
  const recipe = await createRecipe(users, user);
  await openLog(page, user, recipe.slug);
  await scoreOverall(page);
  await notesField(page).fill('kept');

  await context.setOffline(true);
  await save(page);
  await expect(page.getByText('Saving brews needs a connection for now. Your log is kept on this phone.').first()).toBeVisible();
  await expect(notesField(page)).toHaveValue('kept');
  const { count } = await users.admin.from('brews').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  expect(count).toBe(0);

  await context.setOffline(false);
  // The error toast sits over the Save button on a phone.
  await page.getByRole('button', { name: 'Dismiss notification' }).first().click();
  await save(page);
  await page.waitForURL(/\/brews\/[0-9a-f-]{36}$/);
});
