import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './EmptyState.module.css';

type Props = {
  title: string;
  text?: string;
  /** Decorative icon (or any node) above the title. */
  icon?: LucideIcon;
  /** Usually a Button or link. */
  action?: ReactNode;
  /** Heading level for the title; pick the one that fits the page outline. */
  headingLevel?: 2 | 3;
};

export function EmptyState({ title, text, icon, action, headingLevel = 2 }: Props) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section className={styles.empty} aria-label={title}>
      {icon ? (
        <span className={styles.icon}>
          <Icon icon={icon} size="lg" />
        </span>
      ) : null}
      <Heading className={styles.title}>{title}</Heading>
      {text ? <p className={styles.text}>{text}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </section>
  );
}
