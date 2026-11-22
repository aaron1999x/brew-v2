import type { Metadata } from 'next';
import { BrewsList } from '@/components/brews/history/BrewsList';
import { PageShell } from '@/components/shell/PageShell';
import { TopBar } from '@/components/shell/TopBar';
import styles from '../shell.module.css';

export const metadata: Metadata = { title: 'Brews' };

/** `/brews`: every brew of mine, newest first. */
export default function BrewsPage() {
  return (
    <PageShell>
      <TopBar title="Brews" />
      <div className={styles.body}>
        <BrewsList />
      </div>
    </PageShell>
  );
}
