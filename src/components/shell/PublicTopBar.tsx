import Link from 'next/link';
import { siteConfig } from '@/config/site';
import styles from './PublicTopBar.module.css';

/** Slim bar for logged-out visitors: logo, "Verified recipes", "Log in", "Sign up". No tab bar. */
export function PublicTopBar() {
  return (
    <header className={styles.bar}>
      <Link href="/" className={styles.wordmark}>
        {siteConfig.wordmark}
      </Link>
      <nav aria-label="Main" className={styles.nav}>
        <ul className={styles.list}>
          <li>
            <Link href="/verified" className={styles.link} data-primary-control="">
              Verified recipes
            </Link>
          </li>
          <li>
            <Link href="/login" className={styles.link} data-primary-control="">
              Log in
            </Link>
          </li>
          <li>
            <Link href="/signup" className={styles.cta} data-primary-control="">
              Sign up
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
