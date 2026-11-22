'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden/VisuallyHidden';
import { brewChoicePath } from '@/lib/brews/paths';
import { useRecentBrews } from '@/lib/brews/queries';
import { useUnits } from '@/lib/settings/useSettings';
import list from './BrewSelectList.module.css';
import styles from './HomeBrews.module.css';

/**
 * Home under the unfinished brews: "Continue" (the last brewed recipe and version, with Brew again,
 * which opens the choice sheet) and "Recent brews" (the latest 5, overall score first, with See all).
 * With no brews yet it shows `empty` instead.
 */
export function HomeBrews({ empty }: Readonly<{ empty: ReactNode }>) {
  const query = useRecentBrews(5);
  const { dateTime, date } = useUnits();
  const rows = query.data ?? [];
  const last = rows[0];
  const canBrewAgain = Boolean(
    last?.recipe && !last.recipe.deleted_at && last.author_handle_snapshot,
  );

  return (
    <QueryBoundary
      label="your brews"
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
    >
      {last ? (
        <div className={styles.home}>
          <section aria-labelledby="home-continue" className={styles.card}>
            <h2 id="home-continue" className={styles.title}>
              Continue
            </h2>
            <p className={styles.name}>
              {last.recipe_name_snapshot} · v{last.version_no_snapshot}
            </p>
            <p className={styles.meta}>Last brewed {date(last.brewed_at)}</p>
            {canBrewAgain ? (
              <div>
                <ButtonLink
                  href={brewChoicePath(
                    last.author_handle_snapshot!,
                    last.recipe!.slug,
                    last.version_no_snapshot,
                  )}
                >
                  Brew again
                </ButtonLink>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="home-recent" className={styles.card}>
            <div className={styles.head}>
              <h2 id="home-recent" className={styles.title}>
                Recent brews
              </h2>
              <Link href="/brews" className={styles.seeAll} data-primary-control="">
                See all
              </Link>
            </div>
            <ul className={list.list} aria-label="Recent brews">
              {rows.map((brew) => (
                <li key={brew.id} className={list.row}>
                  <Link href={`/brews/${brew.id}`} className={list.link}>
                    <span className={list.score}>
                      <span className={list.scoreValue}>{brew.overall.toFixed(1)}</span>
                      <VisuallyHidden> overall</VisuallyHidden>
                    </span>
                    <span className={list.main}>
                      <span className={list.when}>
                        {brew.recipe_name_snapshot} v{brew.version_no_snapshot}
                      </span>
                      <span className={list.details}>{dateTime(brew.brewed_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        empty
      )}
    </QueryBoundary>
  );
}
