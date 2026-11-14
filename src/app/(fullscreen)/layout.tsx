import type { ReactNode } from 'react';
import { SkipLink } from '@/components/shell/SkipLink';
import styles from './fullscreen.module.css';

/** No tab bar and no top navigation: for the guided timer. */
export default function FullscreenLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </>
  );
}
