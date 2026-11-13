import type { Metadata } from 'next';
import { Coffee } from 'lucide-react';
import { TopBar } from '@/components/shell/TopBar';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import styles from '../shell.module.css';

export const metadata: Metadata = { title: 'Home' };

export default function HomePage() {
  return (
    <>
      <TopBar title="Home" unreadNotices={0} />
      <div className={styles.body}>
        <EmptyState
          icon={Coffee}
          title="Your brew bar is empty"
          text="Create your first recipe or brew one from Verified."
          action={
            <>
              <ButtonLink href="/recipes">New recipe</ButtonLink>
              <ButtonLink href="/verified" variant="secondary">
                Verified
              </ButtonLink>
            </>
          }
        />
      </div>
    </>
  );
}
