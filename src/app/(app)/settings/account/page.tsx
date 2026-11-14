import type { Metadata } from 'next';
import { AccountSettings } from '@/components/account/AccountSettings';
import { TopBar } from '@/components/shell/TopBar';
import { requireUser } from '@/lib/auth/server';
import styles from '../../shell.module.css';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const user = await requireUser('/settings/account');
  return (
    <>
      <TopBar title="Account" backHref="/settings" />
      <div className={styles.body}>
        <AccountSettings email={user.email ?? ''} />
      </div>
    </>
  );
}
