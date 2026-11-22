import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { sanitizeNext } from '@/lib/auth/redirect';
import { SignupForm } from './SignupForm';
import { PageShell } from '@/components/shell/PageShell';

export const metadata: Metadata = { title: 'Sign up' };

type Props = { searchParams: Promise<{ return_to?: string }> };

export default async function SignupPage({ searchParams }: Props) {
  const { return_to } = await searchParams;
  return (
    <PageShell width="narrow">
      <AuthCard
        title="Create your account"
        description="Sign-ups are invite-only for now. Use the email address you were invited with."
        footer={
          <p>
            Already have an account? <Link href="/login">Log in</Link>
          </p>
        }
      >
        <SignupForm returnTo={sanitizeNext(return_to)} />
      </AuthCard>
    </PageShell>
  );
}
