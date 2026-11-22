'use client';

import { Diff } from 'lucide-react';
import Link from 'next/link';
import { Fragment } from 'react';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { LazyTasteRadar } from '@/components/brews/log/LazyTasteRadar';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { Icon } from '@/components/ui/Icon/Icon';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden/VisuallyHidden';
import {
  COMPARE_LETTERS,
  attributeScores,
  buildCompareRows,
  type CompareBrew,
} from '@/lib/brews/compare';
import { useCompareBrews } from '@/lib/brews/queries';
import { useUnits } from '@/lib/settings/useSettings';
import styles from './BrewCompare.module.css';

const PICK = 'Pick 2 or 3 brews to compare.';

/**
 * `/brews/compare?ids=…`, as the prototype's Compare page: the seven taste attributes overlaid in one
 * radar (a line style and a marker per brew, never colour alone), each brew's overall score as a
 * headline number, and a side-by-side table where the rows that differ are marked with an icon and
 * the word "differs". Values are in the person's units.
 */
export function BrewCompare({ ids }: Readonly<{ ids: readonly string[] }>) {
  const query = useCompareBrews(ids);
  const brews = query.data ?? [];
  const tooFew = ids.length < 2 || (query.isSuccess && brews.length < 2);

  return (
    <div className={styles.page}>
      {ids.length < 2 ? (
        <Pick />
      ) : (
        <QueryBoundary
          label="the brews"
          isLoading={query.isPending}
          isError={query.isError}
          onRetry={() => void query.refetch()}
        >
          {tooFew ? <Pick /> : <Comparison brews={brews} />}
        </QueryBoundary>
      )}
    </div>
  );
}

function Pick() {
  return <EmptyState title={PICK} action={<ButtonLink href="/brews">All brews</ButtonLink>} />;
}

function Comparison({ brews }: Readonly<{ brews: readonly CompareBrew[] }>) {
  const { weight, temp, duration, dateTime } = useUnits();
  const rows = buildCompareRows(brews, { weight, temp, duration, dateTime });
  const series = brews.map((b, i) => ({
    key: `b${i}`,
    name: `${COMPARE_LETTERS[i]} · ${dateTime(b.brewed_at)}`,
    values: attributeScores(b),
    overall: b.overall,
  }));

  return (
    <div className={styles.layout}>
      <section aria-labelledby="c-sensory" className={styles.card}>
        <h2 id="c-sensory" className={styles.cardTitle}>
          Sensory overlay
        </h2>
        <ul className={styles.headlines} aria-label="Overall scores">
          {brews.map((b, i) => (
            <li key={b.id} className={styles.headline}>
              <span className={styles.letter} aria-hidden="true">
                {COMPARE_LETTERS[i]}
              </span>
              <span className={styles.headlineScore}>
                <span className={styles.scoreValue}>{b.overall.toFixed(1)}</span>
                <span className={styles.scoreOf}> / 10</span>
              </span>
              <VisuallyHidden>{`Brew ${COMPARE_LETTERS[i]}: overall ${b.overall.toFixed(1)} out of 10`}</VisuallyHidden>
              <span className={styles.headlineName}>{b.recipe_name_snapshot}</span>
            </li>
          ))}
        </ul>
        <LazyTasteRadar series={series} title="Taste, compared" />
      </section>

      <section aria-labelledby="c-table" className={styles.card}>
        <h2 id="c-table" className={styles.cardTitle}>
          Side by side
        </h2>
        <p className={styles.note}>Rows that differ are marked.</p>
        <div className={styles.stack}>
          {rows.map((row, i) => (
            <Fragment key={row.label}>
              {i === 0 || rows[i - 1]!.group !== row.group ? (
                <h3 className={styles.stackGroup}>{row.group}</h3>
              ) : null}
              <dl className={styles.stackRow} data-differs={row.differs ? '' : undefined}>
                <dt className={styles.stackLabel}>
                  {row.differs ? (
                    <span className={styles.differs}>
                      <Icon icon={Diff} size="sm" />
                      <span>{row.label}</span>
                      <span className={styles.differsText}>differs</span>
                    </span>
                  ) : (
                    row.label
                  )}
                </dt>
                {row.values.map((v, j) => (
                  <dd key={j} className={styles.stackValue}>
                    <span className={styles.letterText}>{COMPARE_LETTERS[j]}</span>
                    <span className="num">{v}</span>
                  </dd>
                ))}
              </dl>
            </Fragment>
          ))}
        </div>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">
                  <VisuallyHidden>Measure</VisuallyHidden>
                </th>
                {brews.map((b, i) => (
                  <th key={b.id} scope="col">
                    <Link href={`/brews/${b.id}`} className={styles.colLink}>
                      <span className={styles.letter} aria-hidden="true">
                        {COMPARE_LETTERS[i]}
                      </span>
                      <span>
                        <VisuallyHidden>{`Brew ${COMPARE_LETTERS[i]}: `}</VisuallyHidden>
                        {b.recipe_name_snapshot} v{b.version_no_snapshot}
                      </span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <Fragment key={row.label}>
                  {i === 0 || rows[i - 1]!.group !== row.group ? (
                    <tr className={styles.groupRow}>
                      <th scope="rowgroup" colSpan={brews.length + 1}>
                        {row.group}
                      </th>
                    </tr>
                  ) : null}
                  <tr data-differs={row.differs ? '' : undefined}>
                    <th scope="row" className={styles.rowLabel}>
                      {row.differs ? (
                        <span className={styles.differs}>
                          <Icon icon={Diff} size="sm" />
                          <span>{row.label}</span>
                          <span className={styles.differsText}>differs</span>
                        </span>
                      ) : (
                        row.label
                      )}
                    </th>
                    {row.values.map((v, j) => (
                      <td key={j} className="num">
                        {v}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
