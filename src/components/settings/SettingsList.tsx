import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon/Icon';
import styles from './SettingsList.module.css';

export type SettingsLink = { href: string; label: string; hint?: string };

/** The rows on /settings: each one is a link with a visible label and an optional one-line hint. */
export function SettingsList({
  links,
  children,
}: {
  links: readonly SettingsLink[];
  children?: ReactNode;
}) {
  return (
    <>
      <ul className={styles.list}>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={styles.row} data-primary-control="">
              <span className={styles.text}>
                <span className={styles.label}>{link.label}</span>
                {link.hint ? <span className={styles.hint}>{link.hint}</span> : null}
              </span>
              <Icon icon={ChevronRight} size="md" />
            </Link>
          </li>
        ))}
      </ul>
      {children}
    </>
  );
}
