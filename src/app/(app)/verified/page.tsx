import type { Metadata } from 'next';
import { BadgeCheck } from 'lucide-react';
import { TopBar } from '@/components/shell/TopBar';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import styles from '../shell.module.css';
import { PageShell } from '@/components/shell/PageShell';

export const metadata: Metadata = { title: 'Verified' };

export default function VerifiedPage() {
  return (
    <PageShell>
      <TopBar title="Verified" />
      <div className={styles.body}>
        <EmptyState
          icon={BadgeCheck}
          title="Nothing here yet."
          text="Verified recipes from trusted brewers will appear here soon."
        />
      </div>
    </PageShell>
  );
}
