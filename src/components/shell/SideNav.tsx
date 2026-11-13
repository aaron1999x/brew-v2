'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siteConfig } from '@/config/site';
import { cx } from '@/lib/cx';
import { Icon } from '../ui/Icon/Icon';
import { isCurrent, navItems } from './navItems';
import styles from './SideNav.module.css';

/**
 * The same five destinations for wider screens: a top bar from 768 px, a left rail from 1024 px.
 * Hidden on phones, where BottomTabBar is used instead.
 */
export function SideNav() {
  const pathname = usePathname();
  return (
    <header className={styles.header}>
      <Link href="/home" className={styles.wordmark}>
        {siteConfig.wordmark}
      </Link>
      <nav aria-label="Main" className={styles.nav}>
        <ul className={styles.list}>
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
                className={cx(styles.link, item.primary && styles.primary)}
                data-primary-control=""
              >
                <Icon icon={item.icon} size="md" />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
