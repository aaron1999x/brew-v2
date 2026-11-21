'use client';

import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { useBrewSession } from '@/lib/brews/useBrewSessions';

/**
 * TEMPORARY (Stage 3): stands in for the brew log until Stage 4. The timer ends here, and the
 * unfinished-brew cards on Home link here. Removed in Stage 4's commit.
 */
export function PlaceholderLog({ sessionId }: Readonly<{ sessionId: string | null }>) {
  const { session, ready } = useBrewSession(sessionId);
  return (
    <div style={{ maxWidth: 'var(--layout-form)', marginInline: 'auto', paddingBlock: 'var(--space-6)' }}>
      <EmptyState
        title={ready && session ? `${session.recipeName} v${session.versionNo}` : 'Log your brew'}
        text="The brew log arrives in the next stage. Your brew is kept on this phone."
        action={<ButtonLink href="/home">Back to Home</ButtonLink>}
      />
    </div>
  );
}
