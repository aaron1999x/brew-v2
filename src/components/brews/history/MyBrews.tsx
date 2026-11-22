'use client';

import { useState } from 'react';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { Button } from '@/components/ui/Button/Button';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { Switch } from '@/components/ui/Switch/Switch';
import { useMyBrews } from '@/lib/brews/queries';
import { BrewSelectList } from './BrewSelectList';
import styles from './History.module.css';

/**
 * "My brews" on the owner's recipe page: the brews of the version on screen, newest first, with an
 * "All versions" switch. Tick 2 or 3 to compare. Brews are private, so this never renders on a
 * public page.
 */
export function MyBrews({
  recipeId,
  versionId,
  onBrew,
}: Readonly<{ recipeId: string; versionId: string; onBrew?: () => void }>) {
  const [allVersions, setAllVersions] = useState(false);
  const query = useMyBrews({ recipeId, versionId: allVersions ? undefined : versionId });
  const rows = query.data?.pages.flat() ?? [];

  return (
    <section aria-labelledby="my-brews" className={styles.section}>
      <div className={styles.head}>
        <h2 id="my-brews" className={styles.title}>
          My brews
        </h2>
        <Switch isSelected={allVersions} onChange={setAllVersions}>
          All versions
        </Switch>
      </div>
      <QueryBoundary
        label="your brews"
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      >
        {rows.length === 0 ? (
          <EmptyState
            title={allVersions ? 'No brews of this recipe yet.' : 'No brews of this version yet.'}
            action={onBrew ? <Button onPress={onBrew}>Brew this version</Button> : undefined}
          />
        ) : (
          <>
            <BrewSelectList key={allVersions ? 'all' : versionId} rows={rows} />
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
    </section>
  );
}
