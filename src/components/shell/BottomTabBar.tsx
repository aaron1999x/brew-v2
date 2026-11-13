'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/lib/cx';
import { Icon } from '../ui/Icon/Icon';
import { isCurrent, navItems } from './navItems';
import styles from './BottomTabBar.module.css';

/** Phone navigation: five tabs, the centre one (Brew) larger. Hidden from 768 px, where SideNav takes over. */
export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={styles.bar}>
      <ul className={styles.list}>
        {navItems.map((item) => (
          <li key={item.href} className={styles.cell}>
            <Link
              href={item.href}
              aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
              className={cx(styles.tab, item.primary && styles.primary)}
              data-primary-control=""
            >
              <span className={styles.glyph}>
                <Icon icon={item.icon} size={item.primary ? 'lg' : 'md'} />
              </span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
