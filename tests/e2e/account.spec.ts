import { expectNoAxeViolations } from './helpers/axe';
import { expect, logIn, signIn, test, waitForApp } from './helpers/test-users';

// Uses the staging secret key from the runner's environment and skips without it. No spec sends
// an email: users are created confirmed and invites are only database rows.
test.use({ serviceWorkers: 'block' });

test.describe('change password', () => {
  test('a wrong current password is refused; the right one changes it', async ({ page, users }) => {
    const user = await signIn(page, users, 'passwords');
    await page.goto('/settings/account');
    await waitForApp(page);
    await expect(page.getByTestId('account-email')).toHaveText(user.email);

    const form = page.getByRole('form', { name: 'Change password' });
    await form.getByLabel('Current password').fill('definitely-not-it');
    await form.getByLabel('New password').fill('a-brand-new-password-1');
    await form.getByRole('button', { name: 'Change password' }).click();
    await expect(form.getByText('Your current password is wrong.').first()).toBeVisible();
    // Nothing the person typed is lost.
    await expect(form.getByLabel('New password')).toHaveValue('a-brand-new-password-1');

    await form.getByLabel('Current password').fill(user.password);
    await form.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('Password changed.')).toBeVisible();
    await expect(form.getByLabel('Current password')).toHaveValue('');

    // The new password works and the old one no longer does.
    await expect(
      users.clientFor({ email: user.email, password: 'a-brand-new-password-1' }),
    ).resolves.toBeTruthy();
    await expect(users.clientFor(user)).rejects.toThrow();
  });

  test('a short new password shows the error summary', async ({ page, users }) => {
    const user = await signIn(page, users, 'short');
    await page.goto('/settings/account');
    await waitForApp(page);
    const form = page.getByRole('form', { name: 'Change password' });
    await form.getByLabel('Current password').fill(user.password);
    await form.getByLabel('New password').fill('short');
    await form.getByRole('button', { name: 'Change password' }).click();
    const summary = page.getByRole('group', { name: /Fix 1 thing/ });
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
  });
});

test.describe('download my data', () => {
  test('returns the user data as a JSON file and nothing that belongs to anyone else', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'exporter');
    const other = await users.create('bystander');

    await page.goto('/settings/account');
    await waitForApp(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download my data' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^brew-data-\d{4}-\d{2}-\d{2}\.json$/);

    const text = await (await import('node:fs/promises')).readFile((await file.path())!, 'utf8');
    const data = JSON.parse(text);
    expect(Object.keys(data)).toEqual([
      'schema',
      'exported_at',
      'account',
      'profile',
      'settings',
      'gear',
      'recipes',
      'brews',
      'saved',
      'notifications',
    ]);
    expect(data.schema).toBe(1);
    expect(data.account).toMatchObject({ email: user.email, role: 'member' });
    expect(data.profile).toMatchObject({ id: user.id, handle: user.handle });
    expect(data.settings).toMatchObject({ user_id: user.id });
    for (const section of ['gear', 'recipes', 'brews', 'saved', 'notifications']) {
      expect(data[section]).toEqual([]);
    }
    expect(text).not.toContain(other.id);
    expect(text).not.toContain(other.handle);
  });

  test('a visitor gets 401', async ({ request }) => {
    const response = await request.get('/api/export');
    expect(response.status()).toBe(401);
  });
});

test.describe('delete account', () => {
  test('needs the phrase and the right password, then removes the user, their files and rows', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'goner');
    // A photo, so the file clean-up is exercised (Supabase won't delete a user who owns files).
    const upload = await users.admin.storage
      .from('avatars')
      .upload(`${user.id}/avatar.jpg`, Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        contentType: 'image/jpeg',
      });
    expect(upload.error).toBeNull();
    await users.admin
      .from('profiles')
      .update({ avatar_path: `${user.id}/avatar.jpg` })
      .eq('id', user.id);

    await page.goto('/settings/account');
    await waitForApp(page);
    await page.getByRole('button', { name: 'Delete account' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete your account?' });
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole('button', { name: 'Delete my account' });
    await expect(confirm).toBeDisabled();

    await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
    await dialog.getByLabel('Your password').fill('wrong-password-123');
    await confirm.click();
    await expect(dialog.getByText('Your password is wrong.')).toBeVisible();
    expect((await users.admin.auth.admin.getUserById(user.id)).data.user).not.toBeNull();

    await dialog.getByLabel('Your password').fill(user.password);
    await confirm.click();
    await page.waitForURL('**/goodbye');
    await expect(
      page.getByRole('heading', { name: 'Your account has been deleted' }),
    ).toBeVisible();

    // Gone: the auth user, the rows and the file.
    const gone = await users.admin.auth.admin.getUserById(user.id);
    expect(gone.data.user).toBeNull();
    for (const [table, column] of [
      ['profiles', 'id'],
      ['user_settings', 'user_id'],
      ['account_status', 'user_id'],
    ] as const) {
      const { data } = await users.admin.from(table).select(column).eq(column, user.id);
      expect(data, table).toEqual([]);
    }
    const files = await users.admin.storage.from('avatars').list(user.id);
    expect(files.data ?? []).toEqual([]);

    // Logging in again fails, and the browser is logged out.
    await logIn(page, user, { expectSuccess: false });
    await expect(page.getByText('Email or password is wrong.')).toBeVisible();
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login/);
  });

  test('refuses a request from another site and a request without the phrase', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'safe');
    const crossSite = await page.context().request.post('/api/account/delete', {
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      data: { password: user.password, confirm: 'DELETE' },
    });
    expect(crossSite.status()).toBe(403);

    const noPhrase = await page.context().request.post('/api/account/delete', {
      headers: { Origin: new URL(page.url()).origin, 'Content-Type': 'application/json' },
      data: { password: user.password, confirm: 'delete' },
    });
    expect(noPhrase.status()).toBe(400);
    expect((await users.admin.auth.admin.getUserById(user.id)).data.user).not.toBeNull();
  });
});

test.describe('admin invites', () => {
  test('members get the not-found page and no Settings link', async ({ page, users }) => {
    await signIn(page, users, 'member');
    const response = await page.goto('/admin/invites');
    expect(response?.status()).toBe(404);
    await page.goto('/settings');
    await expect(page.getByRole('link', { name: /Account/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Invites/ })).toHaveCount(0);
  });

  test('visitors are sent to log in', async ({ page }) => {
    await page.goto('/admin/invites');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Finvites/);
  });

  test('an admin adds, lists, copies and removes an invite', async ({ page, users }) => {
    const admin = await users.create('admin');
    const promoted = await users.admin
      .from('account_status')
      .update({ role: 'admin' })
      .eq('user_id', admin.id);
    expect(promoted.error).toBeNull();
    await logIn(page, admin);

    await page.goto('/settings');
    await page.getByRole('link', { name: /Invites/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Invites' })).toBeVisible();
    await waitForApp(page);

    const form = page.getByRole('form', { name: 'Add an invite' });
    await form.getByLabel('Email to invite').fill('not an email');
    await form.getByRole('button', { name: 'Add invite' }).click();
    await expect(form.getByText('Enter a valid email address.')).toBeVisible();

    const email = users.newEmail('invitee');
    await form.getByLabel('Email to invite').fill(email.toUpperCase());
    await form.getByRole('button', { name: 'Add invite' }).click();
    await expect(page.getByText('Invite added.')).toBeVisible();
    const row = page.getByRole('listitem').filter({ hasText: email });
    await expect(row).toBeVisible();
    await expect(row.getByText('Invited', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Copy invite message' }).click();
    await expect(page.getByText(/Invite message copied|Couldn't copy/)).toBeVisible();

    await row.getByRole('button', { name: `Remove invite for ${email}` }).click();
    await expect(page.getByText('Invite removed.')).toBeVisible();
    await expect(row).toHaveCount(0);
    const { data } = await users.admin.from('signup_allowlist').select('email').eq('email', email);
    expect(data).toEqual([]);
  });

  test('an invite that was used shows as signed up and has no Remove button', async ({
    page,
    users,
  }) => {
    const admin = await users.create('admin-used');
    await users.admin.from('account_status').update({ role: 'admin' }).eq('user_id', admin.id);
    const member = await users.create('used');
    await logIn(page, admin);
    await page.goto('/admin/invites');
    await waitForApp(page);
    const row = page.getByRole('listitem').filter({ hasText: member.email });
    await expect(row.getByText('Signed up', { exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: /Remove invite/ })).toHaveCount(0);
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('settings, account, the delete sheet and admin invites have no violations', async ({
      page,
      users,
    }) => {
      const admin = await users.create('axe-admin');
      await users.admin.from('account_status').update({ role: 'admin' }).eq('user_id', admin.id);
      await logIn(page, admin);

      await page.goto('/settings');
      await expect(page.getByRole('link', { name: /Invites/ })).toBeVisible();
      await expectNoAxeViolations(page);

      await page.goto('/settings/account');
      await waitForApp(page);
      await expect(page.getByRole('button', { name: 'Download my data' })).toBeVisible();
      await expectNoAxeViolations(page);

      await page.emulateMedia({ reducedMotion: 'reduce' }); // no fade, so axe sees final colours
      await page.getByRole('button', { name: 'Delete account' }).click();
      await expect(page.getByRole('alertdialog', { name: 'Delete your account?' })).toBeVisible();
      await expectNoAxeViolations(page);
      await page.keyboard.press('Escape');

      await page.goto('/admin/invites');
      await waitForApp(page);
      await expect(page.getByRole('heading', { name: 'Invites', level: 2 })).toBeVisible();
      await expect(page.getByRole('listitem').first()).toBeVisible();
      await expectNoAxeViolations(page);
    });

    test('goodbye has no violations', async ({ page }) => {
      await page.goto('/goodbye');
      await expect(
        page.getByRole('heading', { name: 'Your account has been deleted' }),
      ).toBeVisible();
      await expectNoAxeViolations(page);
    });
  });
}
