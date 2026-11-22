import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { sanitizeNext } from '@/lib/auth/redirect';
import { LoginForm } from './LoginForm';
import { PageShell } from '@/components/shell/PageShell';

export const metadata: Metadata = { title: 'Log in' };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return (
    <PageShell width="narrow">
      <AuthCard
        title="Log in"
        footer={
          <>
            <p>
              <Link href="/forgot-password">Forgot your password?</Link>
            </p>
            <p>
              New here? <Link href="/signup">Create an account</Link>
            </p>
          </>
        }
      >
        <LoginForm next={sanitizeNext(next)} />
      </AuthCard>
    </PageShell>
  );
}
