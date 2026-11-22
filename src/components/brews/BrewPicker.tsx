'use client';

import { Coffee } from 'lucide-react';
import { useMemo, useState } from 'react';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { VersionBadge } from '@/components/ui/Badge/Badge';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { TextField } from '@/components/ui/TextField/TextField';
import { brewCountText, summariseByRecipe, useBrewStats } from '@/lib/brews/stats';
import { brewRatio, formatRatio } from '@/lib/recipes/calc';
import { DEFAULT_LIST_PARAMS, filterRecipes, sortRecipes, type RecipeListItem } from '@/lib/recipes/list';
import { useMyRecipes } from '@/lib/recipes/hooks';
import { methodLabel } from '@/lib/recipes/methods';
import { useUnits } from '@/lib/settings/useSettings';
import { useProfileMe } from '@/lib/profile/useProfileMe';
import { ChoiceSheet } from './ChoiceSheet';
import styles from './BrewPicker.module.css';

/**
 * The centre Brew button's page: search my recipes, newest brewed first, tap one to choose a
 * version and Guided timer or Log only. Archived and deleted recipes are left out.
 */
export function BrewPicker() {
  const recipes = useMyRecipes();
  const stats = useBrewStats();
  const profile = useProfileMe();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<RecipeListItem | null>(null);

  const byRecipe = useMemo(() => summariseByRecipe(stats.data ?? []), [stats.data]);

  const rows = useMemo(() => {
    // Real last-brewed dates (from the brews themselves) once they have loaded.
    const merged = (recipes.data ?? []).map((r) =>
      stats.data ? { ...r, last_brewed_at: byRecipe.get(r.id)?.lastBrewedAt ?? null } : r,
    );
    return sortRecipes(filterRecipes(merged, { ...DEFAULT_LIST_PARAMS, q: query }), 'brewed');
  }, [recipes.data, stats.data, byRecipe, query]);

  const isLoading = recipes.isPending || profile.isPending;
  const hasRecipes = (recipes.data ?? []).some((r) => r.archived_at === null);

  return (
    <div className={styles.picker}>
      <QueryBoundary
        label="your recipes"
        isLoading={isLoading}
        isError={recipes.isError || profile.isError}
        onRetry={() => {
          void recipes.refetch();
          void profile.refetch();
        }}
      >
        {!hasRecipes ? (
          <EmptyState
            icon={Coffee}
            title="Create a recipe first, then brew it here."
            action={<ButtonLink href="/recipes/new">New recipe</ButtonLink>}
          />
        ) : (
          <>
            <TextField
              label="Search your recipes"
              type="search"
              value={query}
              onChange={setQuery}
              inputProps={{ autoCapitalize: 'none', autoCorrect: 'off', enterKeyHint: 'search' }}
            />
            {rows.length === 0 ? (
              <p className={styles.none} role="status">
                No recipes match &ldquo;{query.trim()}&rdquo;.
              </p>
            ) : (
              <ul className={styles.list} aria-label="Your recipes">
                {rows.map((row) => (
                  <li key={row.id}>
                    <PickerRow row={row} count={byRecipe.get(row.id)?.count} onChoose={() => setChosen(row)} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </QueryBoundary>
      {chosen && profile.data ? (
        <ChoiceSheet
          isOpen
          onOpenChange={(open) => {
            if (!open) setChosen(null);
          }}
          handle={profile.data.handle}
          slug={chosen.slug}
        />
      ) : null}
    </div>
  );
}

function PickerRow({
  row,
  count,
  onChoose,
}: Readonly<{ row: RecipeListItem; count: number | undefined; onChoose: () => void }>) {
  const { weight } = useUnits();
  const ratio = formatRatio(brewRatio(row.dose_g, row.brew_water_g));
  const numbers = [
    row.dose_g == null ? null : weight(row.dose_g),
    row.brew_water_g == null ? null : weight(row.brew_water_g),
    ratio,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <button type="button" className={styles.row} onClick={onChoose} data-primary-control="">
      <span className={styles.top}>
        <span className={styles.name}>{row.name}</span>
        <VersionBadge version={row.latest_version_no} />
      </span>
      <span className={styles.meta}>{methodLabel(row.method, row.method_custom)}</span>
      {numbers ? <span className={styles.meta}>{numbers}</span> : null}
      <span className={styles.meta}>{brewCountText(count)}</span>
    </button>
  );
}
