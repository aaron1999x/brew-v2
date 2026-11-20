import type { Metadata } from 'next';
import { DeleteAccountForm } from '@/components/account/DeleteAccountForm';
import { TopBar } from '@/components/shell/TopBar';
import { requireUser } from '@/lib/auth/server';
import styles from '../../../shell.module.css';

export const metadata: Metadata = { title: 'Delete account' };

export default async function DeleteAccountPage() {
  await requireUser('/settings/account/delete');
  return (
    <>
      <TopBar title="Delete account" backHref="/settings/account" />
      <div className={styles.bodyForm}>
        <DeleteAccountForm />
      </div>
    </>
  );
}
