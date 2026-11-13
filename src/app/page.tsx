import { siteConfig } from '@/config/site';
import { appVersion } from '@/lib/version';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{siteConfig.name} — coming soon</h1>
      <p className={styles.meta}>
        Version <span className="num">{appVersion}</span>
      </p>
    </main>
  );
}
