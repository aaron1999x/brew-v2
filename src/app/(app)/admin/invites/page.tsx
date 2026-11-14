import type { Metadata } from 'next';
import { InvitesManager } from '@/components/admin/InvitesManager';
import { TopBar } from '@/components/shell/TopBar';
import { requireAdmin } from '@/lib/auth/server';
import styles from '../../shell.module.css';

export const metadata: Metadata = { title: 'Invites' };

/** Admins only: anyone else, signed in or not, gets the 404 page. */
export default async function InvitesPage() {
  await requireAdmin();
  return (
    <>
      <TopBar title="Invites" backHref="/settings" />
      <div className={styles.body}>
        <InvitesManager />
      </div>
    </>
  );
}
