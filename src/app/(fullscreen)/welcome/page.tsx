import type { Metadata } from 'next';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { requireUser } from '@/lib/auth/server';
import { PageShell } from '@/components/shell/PageShell';

export const metadata: Metadata = { title: 'Welcome' };

/** First-run setup. Every step can be skipped; skipped steps show up on Home as a checklist. */
export default async function WelcomePage() {
  await requireUser('/welcome');
  return (
    <PageShell width="narrow">
      <OnboardingFlow />
    </PageShell>
  );
}
