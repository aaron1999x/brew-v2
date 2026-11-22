import type { Metadata } from 'next';
import { TopBar } from '@/components/shell/TopBar';
import { UnitsForm } from '@/components/settings/UnitsForm';
import { requireUser } from '@/lib/auth/server';
import styles from '../../shell.module.css';
import { PageShell } from '@/components/shell/PageShell';

export const metadata: Metadata = { title: 'Units and region' };

export default async function UnitsPage() {
  await requireUser('/settings/units');
  return (
    <PageShell width="narrow">
      <TopBar title="Units and region" backHref="/settings" />
      <div className={styles.body}>
        <UnitsForm />
      </div>
    </PageShell>
  );
}
