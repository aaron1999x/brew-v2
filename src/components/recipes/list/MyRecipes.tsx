'use client';

import { BookOpen, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { Button } from '@/components/ui/Button/Button';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl';
import { Select } from '@/components/ui/Select/Select';
import { TextField } from '@/components/ui/TextField/TextField';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden/VisuallyHidden';
import { useProfileMe } from '@/lib/profile/useProfileMe';
import { formatRatio, brewRatio } from '@/lib/recipes/calc';
import { useMyRecipes } from '@/lib/recipes/hooks';
import {
  DEFAULT_LIST_PARAMS,
  LIST_SORTS,
  LIST_SORT_LABELS,
  LIST_VISIBILITIES,
  filterRecipes,
  hasFilters,
  listHref,
  parseListParams,
  sortRecipes,
  type ListParams,
  type ListSort,
  type ListTab,
  type ListVisibility,
  type RecipeListItem,
} from '@/lib/recipes/list';
import { BREW_METHODS, METHOD_LABELS, methodLabel, type BrewMethod } from '@/lib/recipes/methods';
import { recipePath } from '@/lib/recipes/paths';
import { useUnits } from '@/lib/settings/useSettings';
import { RecipeActions } from '../RecipeActions';
import styles from './MyRecipes.module.css';

const ANY = 'any';
const SEARCH_DELAY_MS = 250;

const VISIBILITY_LABELS: Record<ListVisibility, string> = {
  private: 'Private',
  public: 'Public',
  hidden: 'Hidden',
};

/**
 * My recipes: search, method and visibility filters and a sort, all kept in the URL so a refresh or
 * a shared link shows the same list. Archived recipes have their own tab. Everything runs on the
 * device over the loaded list.
 */
export function MyRecipes() {
  const router = useRouter();
  const search = useSearchParams();
  const params = useMemo(() => parseListParams(search), [search]);
  const recipes = useMyRecipes();
  const profile = useProfileMe();

  // What is typed shows at once; the URL follows a moment later. `null` means "follow the URL".
  const [typed, setTyped] = useState<string | null>(null);
  const query = typed ?? params.q;
  useEffect(() => {
    if (typed === null || typed === params.q) return;
    const timer = window.setTimeout(
      () => router.replace(listHref({ ...params, q: typed }), { scroll: false }),
      SEARCH_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [typed, params, router]);

  const update = (patch: Partial<ListParams>) => {
    router.replace(listHref({ ...params, ...patch }), { scroll: false });
  };
  const clear = () => {
    setTyped(null);
    router.replace(listHref({ ...DEFAULT_LIST_PARAMS, sort: params.sort, tab: params.tab }), {
      scroll: false,
    });
  };

  const all = useMemo(() => recipes.data ?? [], [recipes.data]);
  const visible = useMemo(
    () => sortRecipes(filterRecipes(all, { ...params, q: query }), params.sort),
    [all, params, query],
  );
  const archivedCount = all.filter((r) => r.archived_at !== null).length;
  const activeCount = all.length - archivedCount;
  const filtered = hasFilters({ ...params, q: query });
  const handle = profile.data?.handle;

  return (
    <div className={styles.page}>
      <div className={styles.controls}>
        <SegmentedControl
          label="Show"
          hideLabel
          segments={[
            { value: 'recipes', label: `Recipes (${activeCount})` },
            { value: 'archived', label: `Archived (${archivedCount})` },
          ]}
          value={params.tab}
          onChange={(tab) => update({ tab: tab as ListTab })}
        />
        <TextField
          label="Search recipes"
          placeholder="Name, coffee, roaster or origin"
          value={query}
          onChange={setTyped}
          inputProps={{ type: 'search', enterKeyHint: 'search', autoCapitalize: 'none' }}
        />
        <div className={styles.pair}>
          <Select
            label="Method"
            options={[
              { id: ANY, label: 'All methods' },
              ...BREW_METHODS.map((m) => ({ id: m, label: METHOD_LABELS[m] })),
            ]}
            selectedKey={params.method ?? ANY}
            onSelectionChange={(key) =>
              update({ method: key === ANY ? null : (String(key) as BrewMethod) })
            }
          />
          <Select
            label="Visibility"
            options={[
              { id: ANY, label: 'All' },
              ...LIST_VISIBILITIES.map((v) => ({ id: v, label: VISIBILITY_LABELS[v] })),
            ]}
            selectedKey={params.visibility ?? ANY}
            onSelectionChange={(key) =>
              update({ visibility: key === ANY ? null : (String(key) as ListVisibility) })
            }
          />
        </div>
        <Select
          label="Sort by"
          options={LIST_SORTS.map((s) => ({ id: s, label: LIST_SORT_LABELS[s] }))}
          selectedKey={params.sort}
          onSelectionChange={(key) => update({ sort: String(key) as ListSort })}
        />
      </div>

      <QueryBoundary
        label="recipes"
        isLoading={recipes.isPending || profile.isPending}
        isError={recipes.isError}
        onRetry={() => void recipes.refetch()}
      >
        {visible.length === 0 ? (
          <Empty tab={params.tab} filtered={filtered} onClear={clear} />
        ) : (
          <>
            <p className={styles.count} role="status">
              <VisuallyHidden>Showing </VisuallyHidden>
              {visible.length} {visible.length === 1 ? 'recipe' : 'recipes'}
            </p>
            <div className={styles.columnHeads} aria-hidden="true">
              <span>Recipe</span>
              <span>Dose</span>
              <span>Water</span>
              <span>Ratio</span>
              <span>Coffee</span>
              <span>Last edited</span>
            </div>
            <ul
              className={styles.list}
              aria-label={params.tab === 'archived' ? 'Archived recipes' : 'Recipes'}
            >
              {handle
                ? visible.map((item) => <Row key={item.id} item={item} handle={handle} />)
                : null}
            </ul>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function Empty({
  tab,
  filtered,
  onClear,
}: Readonly<{ tab: ListTab; filtered: boolean; onClear: () => void }>) {
  if (filtered) {
    return (
      <EmptyState
        icon={SearchX}
        title="No recipes match these filters."
        text="Try a different word, or clear the filters."
        action={<Button onPress={onClear}>Clear filters</Button>}
      />
    );
  }
  if (tab === 'archived') {
    return (
      <EmptyState
        icon={BookOpen}
        title="Archived recipes appear here."
        text="Archive a recipe to tuck it away without deleting it."
      />
    );
  }
  return (
    <EmptyState
      icon={BookOpen}
      title="No recipes yet."
      text="Every recipe you create is private until you share it."
      action={<ButtonLink href="/recipes/new">New recipe</ButtonLink>}
    />
  );
}

function Row({ item, handle }: Readonly<{ item: RecipeListItem; handle: string }>) {
  const { weight, date } = useUnits();
  const ratio = formatRatio(brewRatio(item.dose_g, item.brew_water_g));
  const numbers = [
    item.dose_g != null ? weight(item.dose_g) : null,
    item.brew_water_g != null ? weight(item.brew_water_g) : null,
    ratio,
  ].filter(Boolean);
  return (
    <li className={styles.row}>
      <Link href={recipePath(handle, item.slug)} className={styles.link}>
        <span className={styles.name}>{item.name}</span>
        <span className={styles.meta}>
          {methodLabel(item.method, item.method_custom)} · v{item.latest_version_no}
        </span>
        {numbers.length > 0 ? (
          <span className={`${styles.meta} ${styles.joined} num`}>{numbers.join(' · ')}</span>
        ) : null}
        {item.coffee_name ? (
          <span className={`${styles.meta} ${styles.coffee}`}>{item.coffee_name}</span>
        ) : null}
        {/* From 1024 px the numbers sit in their own columns, so the joined line above is hidden. */}
        <span className={`${styles.meta} ${styles.cell} num`}>
          <VisuallyHidden>Dose </VisuallyHidden>
          {item.dose_g != null ? weight(item.dose_g) : null}
        </span>
        <span className={`${styles.meta} ${styles.cell} num`}>
          <VisuallyHidden>Water </VisuallyHidden>
          {item.brew_water_g != null ? weight(item.brew_water_g) : null}
        </span>
        <span className={`${styles.meta} ${styles.cell} num`}>
          <VisuallyHidden>Ratio </VisuallyHidden>
          {ratio}
        </span>
        <span className={`${styles.meta} ${styles.cell} ${styles.edited}`}>
          <VisuallyHidden>Last edited </VisuallyHidden>
          {date(item.edited_at)}
        </span>
      </Link>
      <RecipeActions
        id={item.id}
        name={item.name}
        handle={handle}
        slug={item.slug}
        archived={item.archived_at !== null}
      />
    </li>
  );
}
