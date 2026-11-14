import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/AuthCard';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';

export const metadata: Metadata = { title: 'Goodbye', robots: { index: false, follow: false } };

export default function GoodbyePage() {
  return (
    <AuthCard
      title="Your account has been deleted"
      description="Your profile, settings, gear, recipes, brews and saved recipes are gone. Thanks for brewing with us."
    >
      <ButtonLink href="/" variant="secondary" size="lg">
        Back to the start
      </ButtonLink>
    </AuthCard>
  );
}
