import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export const metadata: Metadata = { title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your email and we'll send you a link to choose a new one."
      footer={
        <p>
          <Link href="/login">Back to log in</Link>
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
