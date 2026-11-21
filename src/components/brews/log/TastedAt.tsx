'use client';

import { FilterChip } from '@/components/ui/Chips/Chips';
import { TASTED_TEMPS, type TastedTemp } from '@/lib/brews/schema';
import styles from './BrewLogForm.module.css';

const LABELS: Record<TastedTemp, string> = { hot: 'Hot', warm: 'Warm', cool: 'Cool' };

/** Optional: Hot, Warm or Cool. Tapping the chosen one clears it. The same chips as the flavour tags. */
export function TastedAt({
  temp,
  onTempChange,
}: Readonly<{ temp: TastedTemp | null; onTempChange: (value: TastedTemp | null) => void }>) {
  return (
    <div role="group" aria-labelledby="tasted-at-label" className={styles.tastedBlock}>
      <span id="tasted-at-label" className={styles.fieldLabel}>
        Tasted at
      </span>
      <div className={styles.toggleGroup}>
        {TASTED_TEMPS.map((t) => (
          <FilterChip key={t} isSelected={temp === t} onChange={(on) => onTempChange(on ? t : null)}>
            {LABELS[t]}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}
