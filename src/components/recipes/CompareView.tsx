'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { NotAvailable } from '@/components/feedback/NotAvailable';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { Icon } from '@/components/ui/Icon/Icon';
import { Select } from '@/components/ui/Select/Select';
import { diffVersions } from '@/lib/recipes/diff';
import { versionByNo, type RecipeWithVersion } from '@/lib/recipes/fetch';
import { useRecipe } from '@/lib/recipes/hooks';
import { comparePath, recipePath } from '@/lib/recipes/paths';
import { storedDiffInput } from '@/lib/recipes/save';
import { DiffSections } from './Changes';
import { LazyPourCurve } from './LazyPourCurve';
import styles from './Versions.module.css';

type Props = Readonly<{
  handle: string;
  slug: string;
  /** From the URL; the page checks they exist. Default: the version before the latest, and the latest. */
  a: number | null;
  b: number | null;
}>;

/** Two versions side by side: only what changed, in the recipe page's order, and both pour curves. */
export function CompareView({ handle, slug, a, b }: Props) {
  const query = useRecipe(handle, slug);
  return (
    <div className={styles.page}>
      <QueryBoundary
        label="versions"
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      >
        {query.data ? (
          <Compare data={query.data} handle={handle} slug={slug} a={a} b={b} />
        ) : (
          <NotAvailable />
        )}
      </QueryBoundary>
    </div>
  );
}

function Compare({
  data,
  handle,
  slug,
  a,
  b,
}: Readonly<{ data: RecipeWithVersion; handle: string; slug: string } & Pick<Props, 'a' | 'b'>>) {
  const router = useRouter();
  const numbers = data.versions.map((v) => v.version_no);
  const latest = numbers[0]!;
  const bNo = b ?? latest;
  const aNo = a ?? numbers.find((n) => n < bNo) ?? numbers[numbers.length - 1]!;
  const versionA = versionByNo(data.versions, aNo);
  const versionB = versionByNo(data.versions, bNo);

  const diff = useMemo(
    () =>
      versionA && versionB
        ? diffVersions(
            storedDiffInput(data.recipe, versionA),
            storedDiffInput(data.recipe, versionB),
          )
        : null,
    [data.recipe, versionA, versionB],
  );

  if (!versionA || !versionB || !diff) return <NotAvailable />;

  const options = numbers.map((n) => ({
    id: String(n),
    label: n === latest ? `v${n} (latest)` : `v${n}`,
  }));
  const go = (nextA: number, nextB: number) =>
    router.replace(comparePath(handle, slug, nextA, nextB));
  const same = versionA.id === versionB.id;
  const drawdownOf = (v: typeof versionB) =>
    v.drawdown_min_s != null || v.drawdown_max_s != null
      ? { from: v.drawdown_min_s ?? v.drawdown_max_s ?? 0, to: v.drawdown_max_s ?? v.drawdown_min_s ?? 0 }
      : null;

  return (
    <>
      <header className={styles.header}>
        <Link
          href={recipePath(handle, slug)}
          aria-label="Back to the recipe"
          className={styles.back}
          data-primary-control=""
        >
          <Icon icon={ChevronLeft} size="md" />
        </Link>
        <h1 className={styles.title}>Compare versions of {data.recipe.name}</h1>
      </header>

      {numbers.length < 2 ? (
        <p className={styles.note}>
          This recipe has one version so far. Save a change as a new version to compare them.
        </p>
      ) : (
        <>
          <div className={styles.pickers}>
            <Select
              label="Version A"
              options={options}
              selectedKey={String(aNo)}
              onSelectionChange={(key) => go(Number(key), bNo)}
            />
            <Select
              label="Version B"
              options={options}
              selectedKey={String(bNo)}
              onSelectionChange={(key) => go(aNo, Number(key))}
            />
          </div>

          {same ? (
            <p className={styles.note}>Choose two different versions to see what changed.</p>
          ) : (
            <>
              <p className={styles.summary} data-testid="compare-summary" aria-live="polite">
                {diff.count === 0
                  ? `No changes between v${aNo} and v${bNo}`
                  : `${diff.count} ${diff.count === 1 ? 'field' : 'fields'} changed from v${aNo} to v${bNo}`}
              </p>
              {versionA.steps.length > 0 || versionB.steps.length > 0 ? (
                <LazyPourCurve
                  title="Pour curves"
                  series={[
                    { id: versionA.id, label: `v${aNo}`, steps: versionA.steps },
                    { id: versionB.id, label: `v${bNo}`, steps: versionB.steps },
                  ]}
                  drawdown={drawdownOf(versionB)}
                />
              ) : null}
              <DiffSections diff={diff} />
            </>
          )}
        </>
      )}
    </>
  );
}
