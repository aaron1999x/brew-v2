import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { sanitizeNext } from '@/lib/auth/redirect';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = { title: 'Sign up' };

type Props = { searchParams: Promise<{ return_to?: string }> };

export default async function SignupPage({ searchParams }: Props) {
  const { return_to } = await searchParams;
  return (
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
  );
}
