import type { Metadata } from 'next';
import { Coffee } from 'lucide-react';
import { HomeBrews } from '@/components/brews/history/HomeBrews';
import { UnfinishedSessions } from '@/components/brews/UnfinishedSessions';
import { FinishProfileCard } from '@/components/onboarding/FinishProfileCard';
import { TopBar } from '@/components/shell/TopBar';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import styles from '../shell.module.css';
import { PageShell } from '@/components/shell/PageShell';

export const metadata: Metadata = { title: 'Home' };

export default function HomePage() {
  return (
    <PageShell>
      <TopBar title="Home" unreadNotices={0} />
      <div className={styles.body}>
        <UnfinishedSessions />
        <FinishProfileCard />
        <HomeBrews
          empty={
            <EmptyState
              icon={Coffee}
              title="Your brew bar is empty"
              text="Create your first recipe or brew one from Verified."
              action={
                <>
                  <ButtonLink href="/recipes/new">New recipe</ButtonLink>
                  <ButtonLink href="/verified" variant="secondary">
                    Verified
                  </ButtonLink>
                </>
              }
            />
          }
        />
      </div>
    </PageShell>
  );
}
