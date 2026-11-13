import type { Metadata } from 'next';
import { getPublicEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { appVersion, commitSha } from '@/lib/version';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Status', robots: { index: false } };
// Always check the database at request time, never at build time.
export const dynamic = 'force-dynamic';

type Check = { environment: string; host: string; databaseReachable: boolean };

async function runChecks(): Promise<Check> {
  try {
    const env = getPublicEnv();
    const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host;
    try {
      const supabase = await createClient();
      // The publishable key can read the public gear catalogue (row-level security allows it).
      const { error } = await supabase
        .from('gear_catalog')
        .select('*', { count: 'exact', head: true })
        .abortSignal(AbortSignal.timeout(5000));
      return { environment: env.NEXT_PUBLIC_APP_ENV, host, databaseReachable: !error };
    } catch {
      return { environment: env.NEXT_PUBLIC_APP_ENV, host, databaseReachable: false };
    }
  } catch {
    // Invalid or missing environment variables.
    return { environment: 'unknown', host: 'unknown', databaseReachable: false };
  }
}

export default async function StatusPage() {
  const check = await runChecks();

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Status</h1>
      <dl className={styles.list}>
        <div className={styles.row}>
          <dt>Version</dt>
          <dd className="num">{appVersion}</dd>
        </div>
        <div className={styles.row}>
          <dt>Commit</dt>
          <dd className="num">{commitSha}</dd>
        </div>
        <div className={styles.row}>
          <dt>Environment</dt>
          <dd>{check.environment}</dd>
        </div>
        <div className={styles.row}>
          <dt>Supabase host</dt>
          <dd>{check.host}</dd>
        </div>
        <div className={styles.row}>
          <dt>Database</dt>
          <dd>{check.databaseReachable ? 'reachable' : 'not reachable'}</dd>
        </div>
      </dl>
    </main>
  );
}
