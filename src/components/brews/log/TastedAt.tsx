'use client';

import { TASTED_TEMPS, type TastedTemp } from '@/lib/brews/schema';
import { brewFieldId } from '@/lib/brews/form';
import { TypedNumberField } from '@/components/ui/NumberField/TypedNumberField';
import { cx } from '@/lib/cx';
import styles from './BrewLogForm.module.css';

const LABELS: Record<TastedTemp, string> = { hot: 'Hot', warm: 'Warm', cool: 'Cool' };

/** Hot, warm or cool (tapping the chosen one clears it) and minutes after brewing (whole, 0 to 240). */
export function TastedAt({
  temp,
  onTempChange,
  minutes,
  typedMinutes,
  onMinutesChange,
  minutesError,
}: Readonly<{
  temp: TastedTemp | null;
  onTempChange: (value: TastedTemp | null) => void;
  minutes: number | null;
  typedMinutes?: string;
  onMinutesChange: (value: number | null, typed?: string) => void;
  minutesError?: string;
}>) {
  return (
    <div className={styles.tasted}>
      <div role="group" aria-labelledby="tasted-at-label" className={styles.tastedBlock}>
        <span id="tasted-at-label" className={styles.fieldLabel}>
          Tasted at
        </span>
        <div className={styles.toggleGroup}>
          {TASTED_TEMPS.map((t) => (
            <button
              key={t}
              type="button"
              className={cx(styles.toggle, temp === t && styles.toggleOn)}
              aria-pressed={temp === t}
              onClick={() => onTempChange(temp === t ? null : t)}
              data-primary-control=""
            >
              {LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      <TypedNumberField
        id={brewFieldId('tastedAfterMin')}
        label="Minutes after brewing"
        description="0 to 240"
        value={minutes}
        typed={typedMinutes}
        error={minutesError}
        onChange={onMinutesChange}
      />
    </div>
  );
}
