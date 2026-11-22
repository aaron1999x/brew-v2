import type { Metadata } from 'next';
import { BrewCompare } from '@/components/brews/history/BrewCompare';
import { PageShell } from '@/components/shell/PageShell';
import { TopBar } from '@/components/shell/TopBar';
import { parseCompareIds } from '@/lib/brews/compare';
import styles from '../../shell.module.css';

export const metadata: Metadata = { title: 'Compare brews', robots: { index: false, follow: false } };

/** `/brews/compare?ids=a,b,c`: two or three of my brews side by side. */
export default async function CompareBrewsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>;
}) {
  const { ids } = await searchParams;
  return (
    <PageShell>
      <TopBar title="Compare brews" />
      <div className={styles.body}>
        <BrewCompare ids={parseCompareIds(ids)} />
      </div>
    </PageShell>
  );
}
