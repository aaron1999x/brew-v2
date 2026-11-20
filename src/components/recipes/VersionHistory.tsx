'use client';

import { ChevronLeft, Lock } from 'lucide-react';
import Link from 'next/link';
import { NotAvailable } from '@/components/feedback/NotAvailable';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { Badge } from '@/components/ui/Badge/Badge';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { Icon } from '@/components/ui/Icon/Icon';
import { useRecipe } from '@/lib/recipes/hooks';
import { comparePath, recipePath, versionOrLatestPath } from '@/lib/recipes/paths';
import { useUnits } from '@/lib/settings/useSettings';
import styles from './Versions.module.css';

/** Every version of a recipe, newest first: when, what changed, whether it has brews. */
export function VersionHistory({ handle, slug }: Readonly<{ handle: string; slug: string }>) {
  const query = useRecipe(handle, slug);
  const { date } = useUnits();
  return (
    <div className={styles.page}>
      <QueryBoundary
        label="versions"
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      >
        {query.data ? (
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
              <h1 className={styles.title}>Versions of {query.data.recipe.name}</h1>
            </header>

            {query.data.versions.length === 1 ? (
              <p className={styles.note}>
                This is the first version. Brew it, then save what you change as v2.
              </p>
            ) : null}

            <ol className={styles.list} aria-label="Versions, newest first">
              {query.data.versions.map((v, i) => {
                const latest = i === 0;
                const previous = query.data!.versions[i + 1];
                return (
                  <li key={v.id} className={styles.item}>
                    <div className={styles.itemHead}>
                      <h2 className={styles.version}>v{v.version_no}</h2>
                      {latest ? <Badge tone="info">Latest</Badge> : null}
                      {v.locked_at ? (
                        <Badge icon={Lock}>Locked</Badge>
                      ) : null}
                      <span className={styles.when}>{date(v.created_at)}</span>
                    </div>
                    <p className={styles.change}>
                      {v.change_note ? v.change_note : <span className={styles.muted}>No change note</span>}
                    </p>
                    <div className={styles.actions}>
                      <ButtonLink
                        href={versionOrLatestPath(handle, slug, v.version_no, query.data!.version.version_no)}
                        variant="secondary"
                      >
                        View
                      </ButtonLink>
                      {previous ? (
                        <ButtonLink
                          href={comparePath(handle, slug, previous.version_no, v.version_no)}
                          variant="secondary"
                        >
                          Compare with previous
                        </ButtonLink>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <NotAvailable />
        )}
      </QueryBoundary>
    </div>
  );
}
