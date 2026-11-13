import { Bell, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '../ui/Icon/Icon';
import styles from './TopBar.module.css';

/** "Notices" with a count: the badge is visual, the name carries the number. */
export function noticesLabel(unread: number): string {
  if (unread <= 0) return 'Notices';
  return `Notices, ${unread} unread`;
}

export function NoticesBell({ unread, href = '/notices' }: { unread: number; href?: string }) {
  const shown = unread > 99 ? '99+' : String(unread);
  return (
    <Link
      href={href}
      aria-label={noticesLabel(unread)}
      className={styles.bell}
      data-primary-control=""
    >
      <Icon icon={Bell} size="md" />
      {unread > 0 ? (
        <span aria-hidden="true" className={styles.badge}>
          {shown}
        </span>
      ) : null}
    </Link>
  );
}

type Props = {
  /** The page's h1. */
  title: string;
  /** Shows a back button that links here. */
  backHref?: string;
  /** Shows the notices bell with this unread count. */
  unreadNotices?: number;
  /** Extra buttons on the right. */
  actions?: ReactNode;
};

/** Page header for the app shell. Phones use it as the page's title bar; wider screens keep it under the nav. */
export function TopBar({ title, backHref, unreadNotices, actions }: Props) {
  return (
    <header className={styles.bar}>
      {backHref ? (
        <Link href={backHref} aria-label="Back" className={styles.back} data-primary-control="">
          <Icon icon={ChevronLeft} size="md" />
        </Link>
      ) : null}
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.actions}>
        {actions}
        {unreadNotices != null ? <NoticesBell unread={unreadNotices} /> : null}
      </div>
    </header>
  );
}
