import type { ElementType, ReactNode } from 'react';
import styles from './VisuallyHidden.module.css';

type Props = { children: ReactNode; as?: ElementType };

/** Text for screen readers only. */
export function VisuallyHidden({ children, as: Tag = 'span' }: Props) {
  return <Tag className={styles.hidden}>{children}</Tag>;
}
