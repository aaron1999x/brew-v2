'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { Checkbox } from '@/components/ui/Checkbox/Checkbox';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden/VisuallyHidden';
import { comparePathFor } from '@/lib/brews/compare';
import type { BrewListRow } from '@/lib/brews/queries';
import { useUnits } from '@/lib/settings/useSettings';
import styles from './BrewSelectList.module.css';

const MAX_COMPARE = 3;

/**
 * A list of brews, newest first: the overall score is the headline, then the date (and the recipe
 * when `showRecipe`), the extraction yield and the first flavours. Each row opens the brew; a
 * checkbox beside it picks 2 or 3 to compare.
 */
export function BrewSelectList({
  rows,
  showRecipe = false,
  initialSelected = [],
}: Readonly<{
  rows: readonly BrewListRow[];
  showRecipe?: boolean;
  initialSelected?: readonly string[];
}>) {
  const { dateTime } = useUnits();
  const [selected, setSelected] = useState<string[]>([...initialSelected].slice(0, MAX_COMPARE));
  const toggle = (id: string, on: boolean) =>
    setSelected((s) =>
      on ? [...s.filter((x) => x !== id), id].slice(0, MAX_COMPARE) : s.filter((x) => x !== id),
    );
  const full = selected.length >= MAX_COMPARE;

  return (
    <div className={styles.wrap}>
      <div className={styles.bar} aria-live="polite">
        {selected.length >= 2 ? (
          <ButtonLink href={comparePathFor(selected)} variant="secondary">
            {`Compare ${selected.length} brews`}
          </ButtonLink>
        ) : (
          <Button variant="secondary" isDisabled>
            Compare
          </Button>
        )}
        <span className={styles.hint}>
          {selected.length === 0
            ? 'Tick 2 or 3 brews to compare them.'
            : selected.length === 1
              ? 'Tick one more to compare.'
              : full
                ? 'That is 3, the most you can compare.'
                : `${selected.length} ticked.`}
        </span>
      </div>
      <ul className={styles.list} aria-label="Brews">
        {rows.map((brew) => {
          const on = selected.includes(brew.id);
          const when = dateTime(brew.brewed_at);
          const name = `${brew.recipe_name_snapshot} v${brew.version_no_snapshot}`;
          const details = [
            showRecipe ? name : `v${brew.version_no_snapshot}`,
            brew.ey_pct != null ? `EY ${brew.ey_pct}%` : null,
            brew.flavours.slice(0, 3).join(', ') || null,
          ].filter(Boolean);
          return (
            <li key={brew.id} className={styles.row}>
              <Checkbox
                isSelected={on}
                onChange={(next) => toggle(brew.id, next)}
                isDisabled={!on && full}
              >
                <VisuallyHidden>{`Select ${name}, ${when}, to compare`}</VisuallyHidden>
              </Checkbox>
              <Link href={`/brews/${brew.id}`} className={styles.link}>
                <span className={styles.score}>
                  <span className={styles.scoreValue}>{brew.overall.toFixed(1)}</span>
                  <VisuallyHidden> overall</VisuallyHidden>
                </span>
                <span className={styles.main}>
                  <span className={styles.when}>{when}</span>
                  <span className={styles.details}>{details.join(' · ')}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
