'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MIN_PASSWORD_LENGTH, RECOVERY_COOKIE, RECOVERY_COOKIE_PATH } from '@/lib/auth/constants';
import { MESSAGE_LINK_EXPIRED, toUserMessage } from '@/lib/errors/messages';
import { reportUnexpected } from '@/lib/errors/report';
import { createClient } from '@/lib/supabase/server';

export type ResetState = { error: string; expired?: boolean } | undefined;

/** Sets the new password. Needs the session from a verified recovery link (the cookie proves it). */
export async function resetPasswordAction(
  _previous: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const password = String(formData.get('password') ?? '');
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.` };
  }

  const jar = await cookies();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!jar.has(RECOVERY_COOKIE) || !data.user) {
    return { error: MESSAGE_LINK_EXPIRED, expired: true };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    reportUnexpected(error, { where: 'reset-password' });
    return { error: toUserMessage(error) };
  }

  jar.set(RECOVERY_COOKIE, '', { maxAge: 0, path: RECOVERY_COOKIE_PATH });
  redirect('/home?notice=password-changed');
}
