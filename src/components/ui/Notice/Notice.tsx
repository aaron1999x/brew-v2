import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './Notice.module.css';

/** A short, calm message at the top of a page or section. Not a live region: it is not an alert. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className={styles.notice}>
      <Icon icon={Info} size="md" />
      <span>{children}</span>
    </p>
  );
}
