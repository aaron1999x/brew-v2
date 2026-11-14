import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/AuthCard';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { requireUser } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'Welcome' };

/** Placeholder until the onboarding steps arrive (Stage 3). Signed-in users only. */
export default async function WelcomePage() {
  await requireUser('/welcome');
  return (
    <AuthCard title="Welcome" description="Your account is ready.">
      <ButtonLink href="/home" size="lg">
        Look around
      </ButtonLink>
    </AuthCard>
  );
}
