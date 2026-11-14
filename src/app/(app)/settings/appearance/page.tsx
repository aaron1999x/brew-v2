import type { Metadata } from 'next';
import { AppearanceForm } from '@/components/settings/AppearanceForm';
import { TopBar } from '@/components/shell/TopBar';
import { requireUser } from '@/lib/auth/server';
import styles from '../../shell.module.css';

export const metadata: Metadata = { title: 'Appearance' };

export default async function AppearancePage() {
  await requireUser('/settings/appearance');
  return (
    <>
      <TopBar title="Appearance" backHref="/settings" />
      <div className={styles.body}>
        <AppearanceForm />
      </div>
    </>
  );
}
