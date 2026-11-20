import type { Locator, Page } from '@playwright/test';
import { expectNoAxeViolations } from './helpers/axe';
import { expect, signIn, test, waitForApp, type TestUsers } from './helpers/test-users';

// Uses the staging secret key from the runner's environment and skips without it. Service workers
// are blocked: nothing here needs one.
test.use({ serviceWorkers: 'block' });

async function gearRows(users: TestUsers, userId: string) {
  const { data, error } = await users.admin
    .from('gear_items')
    .select('category, custom_name, nickname, notes, is_default, catalog:gear_catalog(name)')
    .eq('user_id', userId)
    .order('created_at');
  expect(error).toBeNull();
  return data!;
}

/** Waits until sheets and dialogs have finished their entry animation. */
async function settled(page: Page) {
  await expect(page.locator('[data-entering]')).toHaveCount(0);
}

async function openAdd(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Add gear' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Add gear' });
  await expect(sheet).toBeVisible();
  return sheet;
}

/** React Aria draws the switch with a hidden input: click what a person clicks, the label. */
async function toggleDefault(sheet: Locator, on: boolean) {
  const toggle = sheet.getByRole('switch', { name: 'Use as default for new recipes' });
  if ((await toggle.isChecked()) !== on) {
    await sheet.getByText('Use as default for new recipes').click();
  }
  if (on) await expect(toggle).toBeChecked();
  else await expect(toggle).not.toBeChecked();
}

async function chooseCategory(page: Page, sheet: Locator, label: string) {
  await sheet.getByRole('button', { name: /Category/ }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

test.describe('my gear', () => {
  test('add from the catalogue and your own, change the default, delete', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'gear');
    await page.goto('/settings/gear');
    await waitForApp(page);

    await expect(
      page.getByText('Add your brewer and grinder so new recipes fill in automatically.'),
    ).toBeVisible();

    // A V60 from the catalogue as the default brewer.
    let sheet = await openAdd(page);
    await sheet.getByRole('combobox', { name: 'Item' }).pressSequentially('v60 02');
    await page.getByRole('option', { name: 'Hario V60 02' }).click();
    await toggleDefault(sheet, true);
    await sheet.getByRole('button', { name: 'Add gear' }).click();
    await expect(page.getByText('Gear added.')).toBeVisible();
    await expect(sheet).toHaveCount(0);

    // A custom grinder with a nickname and notes, also the default.
    sheet = await openAdd(page);
    await chooseCategory(page, sheet, 'Grinder');
    await sheet.getByRole('combobox', { name: 'Item' }).pressSequentially('Hand grinder');
    await page.getByRole('option', { name: /Use “Hand grinder” as a custom item/ }).click();
    await sheet.getByLabel('Nickname (optional)').fill('Old faithful');
    await sheet.getByLabel('Notes (optional)').fill('Zero point at 3 turns');
    await toggleDefault(sheet, true);
    await sheet.getByRole('button', { name: 'Add gear' }).click();
    await expect(page.getByText('Gear added.').first()).toBeVisible();

    // A kettle that is not a default.
    sheet = await openAdd(page);
    await chooseCategory(page, sheet, 'Kettle');
    await sheet.getByRole('combobox', { name: 'Item' }).pressSequentially('Stovetop kettle');
    await page.getByRole('option', { name: /as a custom item/ }).click();
    await sheet.getByRole('button', { name: 'Add gear' }).click();
    await expect(
      page.locator('main').getByRole('button', { name: /Stovetop kettle/ }),
    ).toBeVisible();

    let rows = await gearRows(users, user.id);
    expect(rows).toMatchObject([
      {
        category: 'brewer',
        custom_name: null,
        is_default: true,
        catalog: { name: 'Hario V60 02' },
      },
      {
        category: 'grinder',
        custom_name: 'Hand grinder',
        nickname: 'Old faithful',
        notes: 'Zero point at 3 turns',
        is_default: true,
        catalog: null,
      },
      { category: 'kettle', custom_name: 'Stovetop kettle', is_default: false },
    ]);

    // Grouped in order, nickname first with the real name under it, Default badges on the two.
    await expect(page.locator('main').getByRole('heading', { level: 2 })).toHaveText([
      'Brewer',
      'Grinder',
      'Kettle',
    ]);
    const grinderRow = page.locator('main').getByRole('button', { name: /Old faithful/ });
    await expect(grinderRow).toContainText('Hand grinder');
    await expect(grinderRow).toContainText('Default');
    await expect(
      page.locator('main').getByRole('button', { name: /Stovetop kettle/ }),
    ).not.toContainText('Default');

    // A second brewer becomes the default; the first loses it (one default per category).
    sheet = await openAdd(page);
    await sheet.getByRole('combobox', { name: 'Item' }).pressSequentially('wave 185');
    await page.getByRole('option', { name: 'Kalita Wave 185' }).click();
    await toggleDefault(sheet, true);
    await sheet.getByRole('button', { name: 'Add gear' }).click();
    await expect(
      page.locator('main').getByRole('button', { name: /Kalita Wave 185/ }),
    ).toContainText('Default');
    await expect(
      page.locator('main').getByRole('button', { name: /Hario V60 02/ }),
    ).not.toContainText('Default');
    rows = await gearRows(users, user.id);
    expect(rows.filter((r) => r.category === 'brewer' && r.is_default)).toHaveLength(1);

    // Edit: turn the default off for the grinder.
    await page
      .locator('main')
      .getByRole('button', { name: /Old faithful/ })
      .click();
    sheet = page.getByRole('dialog', { name: 'Edit gear' });
    await expect(sheet.getByLabel('Nickname (optional)')).toHaveValue('Old faithful');
    await expect(
      sheet.getByRole('switch', { name: 'Use as default for new recipes' }),
    ).toBeChecked();
    await toggleDefault(sheet, false);
    await sheet.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Gear saved.')).toBeVisible();
    await expect(
      page.locator('main').getByRole('button', { name: /Old faithful/ }),
    ).not.toContainText('Default');

    // Delete the kettle: confirm first.
    await page
      .locator('main')
      .getByRole('button', { name: /Stovetop kettle/ })
      .click();
    await page
      .getByRole('dialog', { name: 'Edit gear' })
      .getByRole('button', { name: /^Delete/ })
      .click();
    const confirm = page.getByRole('alertdialog', { name: 'Delete Stovetop kettle?' });
    await expect(confirm).toContainText('Recipes that use it keep its name.');
    await confirm.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Gear deleted.')).toBeVisible();
    await expect(page.locator('main').getByRole('button', { name: /Stovetop kettle/ })).toHaveCount(
      0,
    );
    rows = await gearRows(users, user.id);
    expect(rows.map((r) => r.category)).toEqual(['brewer', 'grinder', 'brewer']);
  });

  test('submitting without a choice shows the error summary and keeps what was typed', async ({
    page,
    users,
  }) => {
    await signIn(page, users, 'gear-errors');
    await page.goto('/settings/gear');
    await waitForApp(page);

    const sheet = await openAdd(page);
    await sheet.getByRole('button', { name: 'Add gear' }).click();
    const summary = sheet.getByRole('group', { name: /Fix 1 thing/ });
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(
      sheet.getByText('Search for an item, or type your own name for it.').first(),
    ).toBeVisible();

    // Text typed but no option chosen: say what to do, and don't lose the text.
    const item = sheet.getByRole('combobox', { name: 'Item' });
    await item.pressSequentially('Mystery brewer');
    await sheet.getByLabel('Nickname (optional)').fill('Mine'); // leaving the search closes its list
    await sheet.getByRole('button', { name: 'Add gear' }).click();
    await expect(sheet.getByText(/Use “Mystery brewer” as a custom item/).first()).toBeVisible();
    await expect(item).toHaveValue('Mystery brewer');
    await expect(sheet.getByLabel('Nickname (optional)')).toHaveValue('Mine');

    // The summary link moves focus to the search box.
    await summary.getByRole('link').first().click();
    await expect(item).toBeFocused();
  });

  test('the sheet stays above the keyboard area on a phone-sized viewport', async ({
    page,
    users,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone', 'Phone viewport only');
    await signIn(page, users, 'gear-phone');
    await page.goto('/settings/gear');
    await waitForApp(page);
    const sheet = await openAdd(page);
    await sheet.getByLabel('Notes (optional)').focus();
    const box = await sheet.getByLabel('Notes (optional)').boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('my gear: empty, filled, sheet, errors and delete confirmation have no violations', async ({
      page,
      users,
    }) => {
      const user = await signIn(page, users, 'gear-axe');
      await page.goto('/settings/gear');
      await waitForApp(page);
      await expect(page.getByText('No gear yet')).toBeVisible();
      await settled(page);
      await expectNoAxeViolations(page);

      const { error: insertError } = await users.admin.from('gear_items').insert([
        { user_id: user.id, category: 'brewer', custom_name: 'Dripper', is_default: true },
        {
          user_id: user.id,
          category: 'grinder',
          custom_name: 'Hand grinder',
          nickname: 'Old faithful',
          is_default: false,
        },
      ]);
      expect(insertError).toBeNull();
      await page.reload();
      await waitForApp(page);
      await expect(
        page.locator('main').getByRole('button', { name: /Old faithful/ }),
      ).toBeVisible();
      await settled(page);
      await expectNoAxeViolations(page);

      const sheet = await openAdd(page);
      await settled(page);
      await expectNoAxeViolations(page);
      await sheet.getByRole('button', { name: 'Add gear' }).click();
      await expect(sheet.getByRole('group', { name: /Fix 1 thing/ })).toBeVisible();
      await settled(page);
      await expectNoAxeViolations(page);
      await sheet.getByRole('button', { name: 'Cancel' }).click();

      await page
        .locator('main')
        .getByRole('button', { name: /Old faithful/ })
        .click();
      await page
        .getByRole('dialog', { name: 'Edit gear' })
        .getByRole('button', { name: /^Delete/ })
        .click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await settled(page);
      await expectNoAxeViolations(page);
    });
  });
}

test('the gear step and My gear are reachable by keyboard', async ({ page, users }, testInfo) => {
  test.skip(testInfo.project.name === 'iphone', 'Keyboard-only path: desktop project');
  await signIn(page, users, 'gear-keys');
  await page.goto('/settings');
  await waitForApp(page);
  const link = page.getByRole('link', { name: /My gear/ });
  await link.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/settings/gear');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Add gear' }).focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Add gear' });
  await expect(sheet).toBeVisible();
  const item = sheet.getByRole('combobox', { name: 'Item' });
  await item.focus();
  await page.keyboard.type('v60 02');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(item).toHaveValue('Hario V60 02');
  await page.keyboard.press('Escape');
});
