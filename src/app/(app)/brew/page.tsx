import type { Metadata } from 'next';
import { Coffee } from 'lucide-react';
import { TopBar } from '@/components/shell/TopBar';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import styles from '../shell.module.css';

export const metadata: Metadata = { title: 'Brew' };

export default function BrewPage() {
  return (
    <>
      <TopBar title="Brew" />
      <div className={styles.body}>
        <EmptyState
          icon={Coffee}
          title="You need a recipe to brew."
          text="Create one or pick one from Verified."
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
