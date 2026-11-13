import type { ReactNode } from 'react';
import { PublicTopBar } from '@/components/shell/PublicTopBar';
import { SkipLink } from '@/components/shell/SkipLink';
import styles from './public.module.css';

/** Logged-out shell: a slim top bar and no tab bar. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <SkipLink />
      <PublicTopBar />
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </div>
  );
}
