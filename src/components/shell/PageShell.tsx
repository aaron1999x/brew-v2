import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './PageShell.module.css';

export type PageWidth = 'wide' | 'narrow' | 'timer';

/**
 * The one place a page's width is set. Every route's page renders inside it (a unit test fails
 * otherwise), so a page can't fall back to some other container.
 * - `wide` (the default): the app's width, 75rem. Layouts inside respond to this container.
 * - `narrow`: 40rem, for auth and settings only.
 * - `timer`: a centred phone-width column, for the brew timer screens.
 * Components inside never set a page-level max-width of their own.
 */
export function PageShell({
  width = 'wide',
  children,
}: Readonly<{ width?: PageWidth; children: ReactNode }>) {
  return (
    <div data-page-width={width} className={cx(styles.shell, styles[width])}>
      {children}
    </div>
  );
}
