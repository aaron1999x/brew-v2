import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCacheForTests } from '@/lib/env';

const push = vi.fn();
const signUp = vi.fn();
const rpc = vi.fn();
const reportUnexpected = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc, auth: { signUp } }),
}));
vi.mock('@/lib/errors/report', () => ({ reportUnexpected }));

const { SignupForm } = await import('@/app/(public)/signup/SignupForm');

const INVITE_ONLY = 'Sign-ups are invite-only right now.';
const GENERIC = 'Something went wrong. Try again.';

function renderForm(returnTo: string | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SignupForm returnTo={returnTo} />
    </QueryClientProvider>,
  );
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^Email/), 'friend@example.com');
  await user.type(screen.getByLabelText(/^Password/), 'correct horse battery');
  await user.type(screen.getByLabelText(/^Display name/), 'Friend');
  await user.type(screen.getByLabelText(/^Handle/), 'friend_brews');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

/** can_sign_up answers in order; other RPCs get sensible defaults. */
function canSignUpReturns(...answers: boolean[]) {
  const queue = [...answers];
  rpc.mockImplementation(async (name: string) => {
    if (name === 'can_sign_up')
      return { data: queue.length > 1 ? queue.shift() : queue[0], error: null };
    if (name === 'handle_status') return { data: 'ok', error: null };
    return { data: [], error: null };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://brew.example.com');
  vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging');
  resetEnvCacheForTests();
});

describe('SignupForm', () => {
  it('shows the invite-only message and never calls signUp when the email is not invited', async () => {
    canSignUpReturns(false);
    renderForm();
    await fillAndSubmit();

    expect(await screen.findByText(INVITE_ONLY)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('creates the account with handle, display name, time zone and return_to, then shows "check your email"', async () => {
    canSignUpReturns(true);
    signUp.mockResolvedValue({ data: {}, error: null });
    renderForm('/recipes');
    await fillAndSubmit();

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/signup/check-email'));
    const [args] = signUp.mock.calls[0] ?? [];
    expect(args.email).toBe('friend@example.com');
    expect(args.options.emailRedirectTo).toBe('http://localhost:3000/auth/confirm');
    expect(args.options.data).toMatchObject({
      handle: 'friend_brews',
      display_name: 'Friend',
      return_to: '/recipes',
    });
    expect(typeof args.options.data.time_zone).toBe('string');
    expect(JSON.parse(sessionStorage.getItem('pending-signup') ?? '{}').email).toBe(
      'friend@example.com',
    );
  });

  it('on "Database error saving new user", asks can_sign_up again: false → invite-only', async () => {
    canSignUpReturns(true, false);
    signUp.mockResolvedValue({
      data: {},
      error: { code: 'unexpected_failure', message: 'Database error saving new user', status: 500 },
    });
    renderForm();
    await fillAndSubmit();

    expect(await screen.findByText(INVITE_ONLY)).toBeInTheDocument();
    expect(rpc.mock.calls.filter(([name]) => name === 'can_sign_up')).toHaveLength(2);
    expect(reportUnexpected).not.toHaveBeenCalled();
  });

  it('on "Database error saving new user" with can_sign_up still true: generic message and Sentry', async () => {
    canSignUpReturns(true, true);
    const error = {
      code: 'unexpected_failure',
      message: 'Database error saving new user',
      status: 500,
    };
    signUp.mockResolvedValue({ data: {}, error });
    renderForm();
    await fillAndSubmit();

    expect(await screen.findByText(GENERIC)).toBeInTheDocument();
    expect(screen.queryByText(INVITE_ONLY)).not.toBeInTheDocument();
    expect(reportUnexpected).toHaveBeenCalledWith(error, expect.any(Object), true);
    expect(push).not.toHaveBeenCalled();
  });

  it('keeps what the person typed when sign-up fails', async () => {
    canSignUpReturns(false);
    renderForm();
    await fillAndSubmit();
    await screen.findByText(INVITE_ONLY);
    expect(screen.getByLabelText(/^Email/)).toHaveValue('friend@example.com');
    expect(screen.getByLabelText(/^Display name/)).toHaveValue('Friend');
    expect(screen.getByLabelText(/^Handle/)).toHaveValue('friend_brews');
  });

  it('puts focus on the error summary and creates nothing when fields are empty', async () => {
    canSignUpReturns(true);
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const summary = await screen.findByRole('group', { name: /fix 4 things/i });
    expect(summary).toHaveFocus();
    expect(rpc).not.toHaveBeenCalledWith('can_sign_up', expect.anything());
    expect(signUp).not.toHaveBeenCalled();
  });
});
