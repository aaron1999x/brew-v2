import { expect, logIn, test, waitForApp } from './helpers/test-users';

// These specs use the staging secret key from the runner's environment (see helpers/test-users.ts)
// and skip with a message when it isn't set. No spec makes Supabase send an email: sign-up,
// resend and recover requests are intercepted in the browser, and confirm/recovery links come
// from auth.admin.generateLink tokens.

// The production build registers a service worker; requests that pass through one can slip past
// page.route in WebKit. These specs never need it, so it is blocked.
test.use({ serviceWorkers: 'block' });

const INVITE_ONLY = 'Sign-ups are invite-only right now.';

test.describe('sign-up and invite-only', () => {
  test('an email that is not invited sees the invite-only message and no account is created', async ({
    page,
    users,
  }) => {
    const email = users.newEmail('stranger');
    let signUpRequests = 0;
    await page.route('**/auth/v1/signup**', async (route) => {
      signUpRequests += 1;
      await route.abort();
    });

    await page.goto('/signup');
    await waitForApp(page);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel(/^Password/).fill('correct horse battery');
    await page.getByLabel('Display name').fill('Stranger');
    await page.getByLabel('Handle').fill(`stranger_${Date.now().toString(36)}`);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText(INVITE_ONLY)).toBeVisible();
    expect(signUpRequests).toBe(0);
    expect(await users.userExists(email)).toBe(false);
    // Nothing the person typed is lost.
    await expect(page.getByLabel('Display name')).toHaveValue('Stranger');
  });

  test('the database refuses to create an auth user that is not on the allowlist', async ({
    users,
  }) => {
    const email = users.newEmail('direct');
    const { error } = await users.admin.auth.admin.createUser({
      email,
      password: 'correct horse battery',
      email_confirm: true,
    });
    expect(error).not.toBeNull();
    expect(await users.userExists(email)).toBe(false);
  });

  test('an invited email gets to "Check your email" (request intercepted: no email is sent)', async ({
    page,
    users,
  }) => {
    const email = users.newEmail('invited');
    await users.allowlist(email);
    let body: Record<string, unknown> = {};
    await page.route('**/auth/v1/signup**', async (route) => {
      body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-4000-8000-000000000001',
          aud: 'authenticated',
          role: '',
          email,
          phone: '',
          confirmation_sent_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {},
          identities: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/signup?return_to=/recipes');
    await waitForApp(page);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel(/^Password/).fill('correct horse battery');
    await page.getByLabel('Display name').fill('Invited Friend');
    await page.getByLabel('Handle').fill('invited_friend');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Check your email' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Resend email/ })).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Use a different email' })).toBeVisible();

    expect(body.email).toBe(email);
    const data = (body.data ?? {}) as Record<string, string>;
    expect(data).toMatchObject({
      handle: 'invited_friend',
      display_name: 'Invited Friend',
      return_to: '/recipes',
    });
    expect(data.time_zone).toBeTruthy();
  });

  test('a taken handle shows a message and free suggestions', async ({ page, users }) => {
    const existing = await users.create('taken');
    await page.goto('/signup');
    await waitForApp(page);
    await page.getByLabel('Handle').fill(existing.handle);
    await expect(page.getByText('That handle is taken. Try another.')).toBeVisible();
    const suggestions = page.getByRole('group', { name: 'Free handles you could use' });
    await expect(suggestions.getByRole('button')).toHaveCount(3);
    const first = await suggestions.getByRole('button').first().innerText();
    await suggestions.getByRole('button').first().click();
    await expect(page.getByLabel('Handle')).toHaveValue(first);
    await expect(page.getByText('Available.')).toBeVisible();
  });
});

test.describe('confirming an email link', () => {
  test('opening the link verifies nothing; the button confirms and lands on /welcome', async ({
    page,
    users,
  }) => {
    const user = await users.signupLink();
    await page.goto(`/auth/confirm?token_hash=${user.hashedToken}&type=email`);
    await expect(page.getByRole('heading', { level: 1, name: 'Confirm your email' })).toBeVisible();

    // A scanner (or a reload) opening the link doesn't use it up.
    await page.reload();
    expect(await users.isConfirmed(user.id)).toBe(false);

    await waitForApp(page);
    await page.getByRole('button', { name: 'Confirm email' }).click();
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Units and region' })).toBeVisible();
    expect(await users.isConfirmed(user.id)).toBe(true);
  });

  test('return_to is honoured, then cleared', async ({ page, users }) => {
    const user = await users.signupLink({ return_to: '/recipes' });
    await page.goto(`/auth/confirm?token_hash=${user.hashedToken}&type=email`);
    await waitForApp(page);
    await page.getByRole('button', { name: 'Confirm email' }).click();
    await expect(page).toHaveURL(/\/recipes$/);
    const { data } = await users.admin.auth.admin.getUserById(user.id);
    expect(data.user?.user_metadata?.return_to ?? null).toBeNull();
  });

  test('an unsafe return_to is ignored', async ({ page, users }) => {
    const user = await users.signupLink({ return_to: '//evil.com' });
    await page.goto(`/auth/confirm?token_hash=${user.hashedToken}&type=email`);
    await waitForApp(page);
    await page.getByRole('button', { name: 'Confirm email' }).click();
    await expect(page).toHaveURL(/\/welcome$/);
  });

  test('a link that fell back to the Site URL ("/") is forwarded to /auth/confirm', async ({
    page,
    users,
  }) => {
    const user = await users.signupLink();
    await page.goto(`/?token_hash=${user.hashedToken}&type=email`);
    await expect(page).toHaveURL(/\/auth\/confirm\?token_hash=.+&type=email/);
    await waitForApp(page);
    await page.getByRole('button', { name: 'Confirm email' }).click();
    await expect(page).toHaveURL(/\/welcome$/);
  });

  test('a used or invalid link shows "expired" with a way forward', async ({ page, users }) => {
    const user = await users.signupLink();
    const url = `/auth/confirm?token_hash=${user.hashedToken}&type=email`;
    await page.goto(url);
    await waitForApp(page);
    await page.getByRole('button', { name: 'Confirm email' }).click();
    await expect(page).toHaveURL(/\/welcome$/);

    await page.context().clearCookies();
    await page.goto(url);
    await waitForApp(page);
    await page.getByRole('button', { name: 'Confirm email' }).click();
    await expect(page.getByText('This link has expired or was already used.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible();

    await page.goto('/auth/confirm?token_hash=nonsense&type=recovery');
    await waitForApp(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('This link has expired or was already used.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get a new link' })).toBeVisible();
  });

  test('missing parameters show the expired page', async ({ page, users }) => {
    void users;
    await page.goto('/auth/confirm');
    await expect(page.getByText('This link has expired or was already used.')).toBeVisible();
  });
});

test.describe('log in', () => {
  test('wrong password shows the agreed message and keeps the email', async ({ page, users }) => {
    const user = await users.create('wrongpw');
    await page.goto('/login');
    await waitForApp(page);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel(/^Password/).fill('not the password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Email or password is wrong.')).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveValue(user.email);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('an unconfirmed account is told to confirm and can resend (request intercepted)', async ({
    page,
    users,
  }) => {
    const user = await users.signupLink();
    let resendRequests = 0;
    await page.route('**/auth/v1/resend**', async (route) => {
      resendRequests += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/login');
    await waitForApp(page);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel(/^Password/).fill(user.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Confirm your email first.')).toBeVisible();
    await page.getByRole('button', { name: 'Resend email' }).click();
    await expect(page.getByText('Email sent. Check your inbox.')).toBeVisible();
    expect(resendRequests).toBe(1);
  });

  test('a protected page sends visitors to /login?next=… and back after logging in', async ({
    page,
    users,
  }) => {
    const user = await users.create('next');
    await page.goto('/recipes');
    await expect(page).toHaveURL(/\/login\?next=%2Frecipes$/);
    await waitForApp(page);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel(/^Password/).fill(user.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/recipes$/);
  });

  test('every protected prefix redirects visitors', async ({ page, users }) => {
    void users;
    for (const path of ['/home', '/profile', '/welcome', '/settings/units', '/admin/invites']) {
      await page.goto(path);
      await expect(page).toHaveURL(
        new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/\//g, '%2F')}$`),
      );
    }
    // /verified is public by design.
    await page.goto('/verified');
    await expect(page).toHaveURL(/\/verified$/);
  });

  test('next cannot point to another site', async ({ page, users }) => {
    const user = await users.create('evilnext');
    for (const next of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
      await page.context().clearCookies();
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await waitForApp(page);
      await page.getByLabel('Email').fill(user.email);
      await page.getByLabel(/^Password/).fill(user.password);
      await page.getByRole('button', { name: 'Log in' }).click();
      await expect(page).toHaveURL(/\/home$/);
      expect(new URL(page.url()).hostname).toBe('localhost');
    }
  });

  test('logged-in people skip /login and / and go to /home', async ({ page, users }) => {
    const user = await users.create('skip');
    await logIn(page, user);
    await expect(page).toHaveURL(/\/home$/);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/home$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/home$/);
  });

  test('log out clears the session and shows a toast', async ({ page, users }) => {
    const user = await users.create('logout');
    await logIn(page, user);
    await page.goto('/profile');
    await waitForApp(page);
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Logged out.')).toBeVisible();
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login\?next=%2Fhome$/);
  });

  test('a suspended account can log in and sees the banner', async ({ page, users }) => {
    const user = await users.create('suspended');
    const { error } = await users.admin
      .from('account_status')
      .update({ suspended_at: new Date().toISOString(), suspended_reason: 'e2e' })
      .eq('user_id', user.id);
    expect(error).toBeNull();
    await logIn(page, user);
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText('Your account is suspended.')).toBeVisible();
  });
});

test.describe('password reset', () => {
  test('"forgot password" always gives the same answer (request intercepted: no email)', async ({
    page,
    users,
  }) => {
    void users;
    let recoverRequests = 0;
    await page.route('**/auth/v1/recover**', async (route) => {
      recoverRequests += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/forgot-password');
    await waitForApp(page);
    await page.getByLabel('Email').fill('nobody-at-all@test.invalid');
    await page.getByRole('button', { name: 'Send link' }).click();
    await expect(
      page.getByText("If an account exists for that email, we've sent a link."),
    ).toBeVisible();
    expect(recoverRequests).toBe(1);
  });

  test('reset end to end: link → confirm → new password → Home → log in with it', async ({
    page,
    users,
  }) => {
    const user = await users.create('reset');
    const token = await users.recoveryToken(user.email);

    await page.goto(`/auth/confirm?token_hash=${token}&type=recovery`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Choose a new password' }),
    ).toBeVisible();
    await page.reload(); // opening it again doesn't spend it
    await waitForApp(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/reset-password$/);

    // Too short: summary takes focus, nothing is saved.
    await waitForApp(page);
    await page.getByLabel(/^New password/).fill('short');
    await page.getByRole('button', { name: 'Save password' }).click();
    const summary = page.getByRole('group', { name: /fix 1 thing/i });
    await expect(summary).toBeFocused();

    const newPassword = `new-${Date.now()}-password`;
    await page.getByLabel(/^New password/).fill(newPassword);
    await page.getByRole('button', { name: 'Save password' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText('Password changed.')).toBeVisible();

    await page.goto('/profile');
    await waitForApp(page);
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    // The old password no longer works; the new one does.
    await logIn(page, { email: user.email, password: user.password }, { expectSuccess: false });
    await expect(page.getByText('Email or password is wrong.')).toBeVisible();
    await logIn(page, { email: user.email, password: newPassword });
    await expect(page).toHaveURL(/\/home$/);
  });

  test('/reset-password without a verified link is "expired", even when logged in', async ({
    page,
    users,
  }) => {
    await page.goto('/reset-password');
    await expect(page.getByText('This link has expired or was already used.')).toBeVisible();

    const user = await users.create('noreset');
    await logIn(page, user);
    await expect(page).toHaveURL(/\/home$/);
    await page.goto('/reset-password');
    await expect(page.getByText('This link has expired or was already used.')).toBeVisible();
  });
});
