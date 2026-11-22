import type { Metadata } from 'next';
import { GearList } from '@/components/gear/GearList';
import { TopBar } from '@/components/shell/TopBar';
import { requireUser } from '@/lib/auth/server';
import styles from '../../shell.module.css';
import { PageShell } from '@/components/shell/PageShell';

export const metadata: Metadata = { title: 'My gear' };

export default async function GearPage() {
  await requireUser('/settings/gear');
  return (
    <PageShell width="narrow">
      <TopBar title="My gear" backHref="/settings" />
      <div className={styles.body}>
        <GearList />
      </div>
    </PageShell>
  );
}
