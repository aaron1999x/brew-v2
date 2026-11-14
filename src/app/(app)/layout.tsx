import type { ReactNode } from 'react';
import { BottomTabBar } from '@/components/shell/BottomTabBar';
import { SideNav } from '@/components/shell/SideNav';
import { SkipLink } from '@/components/shell/SkipLink';
import { SuspendedBanner } from '@/components/shell/SuspendedBanner';
import { getAccountStatus } from '@/lib/auth/server';
import styles from './shell.module.css';

/** Signed-in shell: tab bar on phones, top bar from 768 px, left rail from 1024 px. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const status = await getAccountStatus();
  return (
    <div className={styles.shell}>
      <SkipLink />
      <SideNav />
      <main id="main" tabIndex={-1} className={styles.main}>
        {status?.suspended_at ? <SuspendedBanner /> : null}
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
