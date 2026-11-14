import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ExpiredLink } from '@/components/auth/ExpiredLink';
import { RECOVERY_COOKIE } from '@/lib/auth/constants';
import { getUser } from '@/lib/auth/server';
import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
};

/** Needs the recovery session: a verified reset link, in the last 15 minutes. */
export default async function ResetPasswordPage() {
  const hasRecovery = (await cookies()).has(RECOVERY_COOKIE);
  const user = hasRecovery ? await getUser() : null;
  if (!user) return <ExpiredLink recovery />;
  return <ResetPasswordForm />;
}
