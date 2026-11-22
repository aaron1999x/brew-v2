'use client';

import { useSearchParams } from 'next/navigation';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { Button } from '@/components/ui/Button/Button';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { parseCompareIds } from '@/lib/brews/compare';
import { useMyBrews } from '@/lib/brews/queries';
import { BrewSelectList } from './BrewSelectList';
import styles from './History.module.css';

/** `/brews`: every brew of mine, newest first, 30 at a time. Tick 2 or 3 to compare. */
export function BrewsList() {
  const search = useSearchParams();
  // `?select=<id>` (the detail page's Compare button) starts with that brew ticked.
  const preselected = parseCompareIds(search.get('select'));
  const query = useMyBrews({});
  const rows = query.data?.pages.flat() ?? [];

  return (
    <div className={styles.page}>
      <QueryBoundary
        label="your brews"
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Brews you log appear here."
            action={<ButtonLink href="/brew">Brew</ButtonLink>}
          />
        ) : (
          <>
            <BrewSelectList rows={rows} showRecipe initialSelected={preselected} />
            {query.hasNextPage ? (
              <Button
                variant="secondary"
                onPress={() => void query.fetchNextPage()}
                isPending={query.isFetchingNextPage}
                pendingLabel="Loading…"
              >
                Load more
              </Button>
            ) : null}
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
