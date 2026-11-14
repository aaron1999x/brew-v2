'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  isConfirmType,
  RECOVERY_COOKIE,
  RECOVERY_COOKIE_MAX_AGE_S,
  RECOVERY_COOKIE_PATH,
} from '@/lib/auth/constants';
import { sanitizeNext } from '@/lib/auth/redirect';
import { MESSAGE_LINK_EXPIRED } from '@/lib/errors/messages';
import { reportUnexpected } from '@/lib/errors/report';
import { createClient } from '@/lib/supabase/server';

export type ConfirmState = { error: string } | undefined;

/**
 * The only place a one-time email token is used. GET /auth/confirm renders a button that posts
 * here, so email security scanners that open the link can't use the token up.
 */
export async function confirmAction(
  _previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const tokenHash = String(formData.get('token_hash') ?? '');
  const type = String(formData.get('type') ?? '');
  if (!tokenHash || !isConfirmType(type)) return { error: MESSAGE_LINK_EXPIRED };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) {
    if (error) reportUnexpected(error, { where: 'verifyOtp', type });
    return { error: MESSAGE_LINK_EXPIRED };
  }

  if (type === 'recovery') {
    (await cookies()).set(RECOVERY_COOKIE, '1', {
      httpOnly: true,
      sameSite: 'lax',
      // Secure only when the request really came over https (Vercel sets x-forwarded-proto).
      // A Secure cookie on plain-http localhost is dropped by WebKit.
      secure: (await headers()).get('x-forwarded-proto') === 'https',
      maxAge: RECOVERY_COOKIE_MAX_AGE_S,
      path: RECOVERY_COOKIE_PATH,
    });
    redirect('/reset-password');
  }

  // Confirmed sign-up: return_to (if safe), else onboarding if it hasn't started, else Home.
  const returnTo = sanitizeNext(
    typeof data.user.user_metadata?.return_to === 'string'
      ? data.user.user_metadata.return_to
      : null,
  );
  let destination = returnTo;
  if (!destination) {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('onboarding')
      .eq('user_id', data.user.id)
      .maybeSingle();
    const onboarding = settings?.onboarding as Record<string, unknown> | null | undefined;
    destination = typeof onboarding?.started_at === 'string' ? '/home' : '/welcome';
  }
  if (data.user.user_metadata && 'return_to' in data.user.user_metadata) {
    await supabase.auth.updateUser({ data: { return_to: null } });
  }
  redirect(destination);
}
