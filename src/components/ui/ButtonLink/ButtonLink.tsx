import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from '../Button/Button.module.css';
import type { ButtonSize, ButtonVariant } from '../Button/Button';

/** A link that looks like a Button, for actions that navigate. */
export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(styles.button, styles[variant], styles[size])}
      data-primary-control={size === 'sm' ? undefined : ''}
    >
      <span className={styles.content}>{children}</span>
    </Link>
  );
}
