import type { Metadata } from 'next';
import { GearList } from '@/components/gear/GearList';
import { TopBar } from '@/components/shell/TopBar';
import { requireUser } from '@/lib/auth/server';
import styles from '../../shell.module.css';

export const metadata: Metadata = { title: 'My gear' };

export default async function GearPage() {
  await requireUser('/settings/gear');
  return (
    <>
      <TopBar title="My gear" backHref="/settings" />
      <div className={styles.bodyForm}>
        <GearList />
      </div>
    </>
  );
}
