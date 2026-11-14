import type { Metadata } from 'next';
import { TopBar } from '@/components/shell/TopBar';
import { UnitsForm } from '@/components/settings/UnitsForm';
import { requireUser } from '@/lib/auth/server';
import styles from '../../shell.module.css';

export const metadata: Metadata = { title: 'Units and region' };

export default async function UnitsPage() {
  await requireUser('/settings/units');
  return (
    <>
      <TopBar title="Units and region" backHref="/settings" />
      <div className={styles.body}>
        <UnitsForm />
      </div>
    </>
  );
}
