import type { ReactNode } from 'react';
import { BottomTabBar } from '@/components/shell/BottomTabBar';
import { SideNav } from '@/components/shell/SideNav';
import { SkipLink } from '@/components/shell/SkipLink';
import styles from './shell.module.css';

/** Signed-in shell: tab bar on phones, top bar from 768 px, left rail from 1024 px. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <SkipLink />
      <SideNav />
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
