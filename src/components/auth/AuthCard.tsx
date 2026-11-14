import type { ReactNode } from 'react';
import styles from './AuthCard.module.css';

type Props = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Links to the other auth screens, shown under the form. */
  footer?: ReactNode;
};

/** The shared frame for sign-up, log-in, reset and confirm screens. */
export function AuthCard({ title, description, children, footer }: Props) {
  return (
    <section className={styles.card}>
      <h1 className={styles.title}>{title}</h1>
      {description ? <p className={styles.description}>{description}</p> : null}
      {children}
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </section>
  );
}
