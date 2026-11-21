'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ChoiceSheet } from '@/components/brews/ChoiceSheet';
import { NotAvailable } from '@/components/feedback/NotAvailable';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { Button } from '@/components/ui/Button/Button';
import { useOnlineStatus } from '@/components/ui/OfflineBanner/OfflineBanner';
import { toast } from '@/components/ui/Toast/toast';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { Select } from '@/components/ui/Select/Select';
import type { RecipeWithVersion } from '@/lib/recipes/fetch';
import { versionByNo } from '@/lib/recipes/fetch';
import { useRecipe } from '@/lib/recipes/hooks';
import { RECIPE_OFFLINE_MESSAGE, useArchiveRecipe } from '@/lib/recipes/lifecycle';
import {
  comparePath,
  editPath,
  newVersionPath,
  recipePath,
  versionOrLatestPath,
  versionsPath,
} from '@/lib/recipes/paths';
import { RecipeActions } from './RecipeActions';
import { RecipeView } from './RecipeView';
import styles from './RecipePage.module.css';

type Props = Readonly<{
  handle: string;
  slug: string;
  /** A specific version (`/v/N`); the latest when left out. */
  versionNo?: number | null;
}>;

/** The owner's recipe page: the read-only view plus the version switcher and the owner's actions. */
export function RecipePage({ handle, slug, versionNo = null }: Props) {
  const query = useRecipe(handle, slug);
  return (
    <div className={styles.page}>
      <QueryBoundary
        label="recipe"
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      >
        {query.data ? (
          <OwnerRecipe data={query.data} handle={handle} slug={slug} versionNo={versionNo} />
        ) : (
          <NotAvailable />
        )}
      </QueryBoundary>
    </div>
  );
}

function OwnerRecipe({
  data,
  handle,
  slug,
  versionNo,
}: Readonly<{ data: RecipeWithVersion; handle: string; slug: string; versionNo: number | null }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const archive = useArchiveRecipe();
  const online = useOnlineStatus();
  // `?brew=1` opens the choice sheet: every "Brew again" link and a timer link with no session land here.
  const [brewOpen, setBrewOpen] = useState(searchParams.get('brew') === '1');
  const version = versionByNo(data.versions, versionNo);
  if (!version) return <NotAvailable />;
  const latestNo = data.version.version_no;
  const count = data.versions.length;
  const archived = data.recipe.archived_at !== null;

  return (
    <>
    <RecipeView
      recipe={data.recipe}
      version={version}
      versionCount={count}
      backHref="/recipes"
      switcher={
        count > 1 ? (
          <VersionSwitcher
            handle={handle}
            slug={slug}
            current={version.version_no}
            latest={latestNo}
            numbers={data.versions.map((v) => v.version_no)}
          />
        ) : null
      }
      actions={
        <div className={styles.actions}>
          {archived ? null : (
            <Button onPress={() => setBrewOpen(true)}>Brew this version</Button>
          )}
          <ButtonLink href={editPath(handle, slug, version.version_no)} variant="secondary">
            Edit
          </ButtonLink>
          <ButtonLink href={newVersionPath(handle, slug, version.version_no)} variant="secondary">
            New version
          </ButtonLink>
          <ButtonLink href={versionsPath(handle, slug)} variant="secondary">
            Versions
          </ButtonLink>
          {count > 1 ? (
            <ButtonLink
              href={comparePath(handle, slug, ...defaultCompare(data.versions.map((v) => v.version_no)))}
              variant="secondary"
            >
              Compare
            </ButtonLink>
          ) : null}
          {data.recipe.archived_at ? (
            <Button
              variant="secondary"
              onPress={() => {
                if (!online) {
                  toast.error(RECIPE_OFFLINE_MESSAGE);
                  return;
                }
                archive.mutate({ id: data.recipe.id, name: data.recipe.name, archived: false });
              }}
            >
              Restore
            </Button>
          ) : null}
          <RecipeActions
            id={data.recipe.id}
            name={data.recipe.name}
            handle={handle}
            slug={slug}
            archived={data.recipe.archived_at !== null}
            versionNo={version.version_no}
            onDeleted={() => router.replace('/recipes')}
          />
        </div>
      }
      notice={
        version.version_no !== latestNo ? (
          <p className={styles.muted}>
            You&apos;re looking at v{version.version_no}.{' '}
            <a href={recipePath(handle, slug)}>See the latest, v{latestNo}</a>
          </p>
        ) : null
      }
    />
    <ChoiceSheet
      isOpen={brewOpen}
      onOpenChange={(open) => {
        setBrewOpen(open);
        // Drop ?brew=1 so Back doesn't reopen the sheet.
        if (!open && searchParams.get('brew') === '1') router.replace(pathname);
      }}
      handle={handle}
      slug={slug}
      versionNo={version.version_no}
    />
    </>
  );
}

/** Older then newer: the two newest versions, as the compare page's default. */
function defaultCompare(numbersNewestFirst: number[]): [number, number] {
  const [latest, previous] = numbersNewestFirst;
  return [previous ?? latest ?? 1, latest ?? 1];
}

function VersionSwitcher({
  handle,
  slug,
  current,
  latest,
  numbers,
}: Readonly<{
  handle: string;
  slug: string;
  current: number;
  latest: number;
  numbers: number[];
}>) {
  const router = useRouter();
  return (
    <Select
      label="Version"
      options={numbers.map((n) => ({
        id: String(n),
        label: n === latest ? `v${n} (latest)` : `v${n}`,
      }))}
      selectedKey={String(current)}
      onSelectionChange={(key) => {
        const next = Number(key);
        if (next !== current) router.push(versionOrLatestPath(handle, slug, next, latest));
      }}
    />
  );
}
