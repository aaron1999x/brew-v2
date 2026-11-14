import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { test as base, expect, type Page } from '@playwright/test';

/**
 * Test users for end-to-end specs. Uses the staging SECRET key from the test runner's own
 * environment (never the browser), and never makes Supabase send an email:
 *  - users are created with `auth.admin.createUser` (confirmed) or `auth.admin.generateLink`
 *    (sign-up / recovery links; the spec opens /auth/confirm with the returned hashed token);
 *  - specs that press "send" buttons intercept the Auth request in the browser.
 * Every user and allowlist row is deleted in teardown, and a global teardown checks nothing is left.
 */

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const TEST_DOMAIN = '@test.invalid';

export function adminSkipReason(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SECRET_KEY ?? '';
  const staging = (process.env.STAGING_PROJECT_REF ?? '').trim();
  const production = (process.env.PRODUCTION_PROJECT_REF ?? '').trim();
  if (!url || !key.startsWith('sb_secret_')) {
    return 'SUPABASE_SECRET_KEY is not set, so the account specs are skipped (they need a staging secret key).';
  }
  if (!staging || !url.includes(staging) || (production && url.includes(production))) {
    return 'NEXT_PUBLIC_SUPABASE_URL is not the staging project, so the account specs are skipped.';
  }
  return null;
}

export function createAdminClient(): SupabaseClient {
  const reason = adminSkipReason();
  if (reason) throw new Error(reason);
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type TestUser = { id: string; email: string; password: string; handle: string };

function unique() {
  return randomBytes(5).toString('hex');
}

export class TestUsers {
  readonly admin = createAdminClient();
  private readonly userIds: string[] = [];
  private readonly emails: string[] = [];

  newEmail(label = 'user') {
    const email = `e2e-${label}-${unique()}${TEST_DOMAIN}`;
    this.emails.push(email);
    return email;
  }

  async allowlist(email: string) {
    const { error } = await this.admin.from('signup_allowlist').insert({ email });
    if (error) throw new Error(`allowlist: ${error.message}`);
  }

  /** A confirmed user, ready to log in. */
  async create(label = 'user'): Promise<TestUser> {
    const email = this.newEmail(label);
    const password = `pw-${unique()}-${unique()}`;
    const handle = `e2e_${unique()}`;
    await this.allowlist(email);
    const { data, error } = await this.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { handle, display_name: `E2E ${label}`, time_zone: 'UTC' },
    });
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
    this.userIds.push(data.user.id);
    return { id: data.user.id, email, password, handle };
  }

  /**
   * An UNCONFIRMED user plus the token a sign-up email would carry (no email is sent).
   * Open `/auth/confirm?token_hash=<hashedToken>&type=email` to confirm.
   */
  async signupLink(
    metadata: Record<string, string> = {},
  ): Promise<TestUser & { hashedToken: string }> {
    const email = this.newEmail('signup');
    const password = `pw-${unique()}-${unique()}`;
    const handle = `e2e_${unique()}`;
    await this.allowlist(email);
    const { data, error } = await this.admin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: { data: { handle, display_name: 'E2E signup', time_zone: 'UTC', ...metadata } },
    });
    if (error || !data.user) throw new Error(`generateLink(signup): ${error?.message}`);
    this.userIds.push(data.user.id);
    return { id: data.user.id, email, password, handle, hashedToken: data.properties.hashed_token };
  }

  /** The token a reset-password email would carry for an existing user (no email is sent). */
  async recoveryToken(email: string): Promise<string> {
    const { data, error } = await this.admin.auth.admin.generateLink({ type: 'recovery', email });
    if (error) throw new Error(`generateLink(recovery): ${error.message}`);
    return data.properties.hashed_token;
  }

  async isConfirmed(id: string): Promise<boolean> {
    const { data, error } = await this.admin.auth.admin.getUserById(id);
    if (error || !data.user) throw new Error(`getUserById: ${error?.message}`);
    return Boolean(data.user.email_confirmed_at);
  }

  async userExists(email: string): Promise<boolean> {
    for (let page = 1; ; page += 1) {
      const { data, error } = await this.admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(`listUsers: ${error.message}`);
      if (data.users.some((u) => u.email === email)) return true;
      if (data.users.length < 1000) return false;
    }
  }

  async cleanup() {
    for (const id of this.userIds) await this.admin.auth.admin.deleteUser(id);
    if (this.emails.length > 0) {
      await this.admin.from('signup_allowlist').delete().in('email', this.emails);
    }
  }
}

/** Fails if any @test.invalid user or allowlist row is left on staging. */
export async function assertNoTestUsersLeft() {
  const admin = createAdminClient();
  const left: string[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    left.push(...data.users.filter((u) => u.email?.endsWith(TEST_DOMAIN)).map((u) => u.email!));
    if (data.users.length < 1000) break;
  }
  const { data: rows } = await admin
    .from('signup_allowlist')
    .select('email')
    .like('email', `%${TEST_DOMAIN}`);
  left.push(...(rows ?? []).map((r) => r.email as string));
  if (left.length > 0) {
    throw new Error(`Test users or allowlist rows left on staging: ${left.join(', ')}`);
  }
}

/** `test` with a `users` fixture that cleans up after itself, and a skip when there is no secret key. */
/** Auth endpoints that make Supabase send an email. */
const EMAIL_SENDING_AUTH_REQUESTS = /\/auth\/v1\/(signup|resend|recover|otp|magiclink|user)(\?|$)/;

export const test = base.extend<{ users: TestUsers; emailGuard: void }>({
  /**
   * Safety net, on for every test: an Auth request that could send an email and was NOT
   * intercepted by the spec itself (spec routes are registered later, so they win) is aborted
   * here and fails the test. Nothing can reach Supabase's mailer by accident.
   */
  emailGuard: [
    async ({ context }, provide) => {
      const blocked: string[] = [];
      await context.route(EMAIL_SENDING_AUTH_REQUESTS, async (route) => {
        const request = route.request();
        // PUT /user is a password change (no email); only block the sending endpoints.
        if (request.url().includes('/auth/v1/user')) return route.continue();
        blocked.push(`${request.method()} ${new URL(request.url()).pathname}`);
        await route.abort();
      });
      await provide();
      expect(blocked, 'an email-sending Auth request was not intercepted by the spec').toEqual([]);
    },
    { auto: true },
  ],

  users: async ({}, provide, testInfo) => {
    const reason = adminSkipReason();
    testInfo.skip(Boolean(reason), reason ?? '');
    const users = new TestUsers();
    try {
      await provide(users);
    } finally {
      await users.cleanup();
    }
  },
});

export { expect };

/** Waits until React is interactive (set by Providers), so typing isn't lost. */
export async function waitForApp(page: Page) {
  await page.locator('html[data-app-ready="true"]').waitFor({ state: 'attached' });
}

/** Log in through the real form; by default waits until the log-in has finished. */
export async function logIn(
  page: Page,
  user: Pick<TestUser, 'email' | 'password'>,
  { expectSuccess = true }: { expectSuccess?: boolean } = {},
) {
  await page.goto('/login');
  await waitForApp(page);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel(/^Password/).fill(user.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  if (expectSuccess) await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** Creates a confirmed test user (cleaned up with the `users` fixture) and logs in through the form. */
export async function signIn(page: Page, users: TestUsers, label = 'shell'): Promise<TestUser> {
  const user = await users.create(label);
  await logIn(page, user);
  return user;
}
