'use client';

import { keyStats, type KeyStat, type KeyStatsVersion } from '@/lib/recipes/key-stats';
import { useUnits } from '@/lib/settings/useSettings';
import styles from './KeyNumbers.module.css';

function Stat({ stat }: { stat: KeyStat }) {
  return (
    <div className={styles.stat}>
      <dt className={styles.label}>{stat.label}</dt>
      <dd className={styles.value}>{stat.value}</dd>
      {stat.sub ? <dd className={styles.sub}>{stat.sub}</dd> : null}
    </div>
  );
}

/**
 * A version's key numbers in two tiers: the numbers read while brewing (large), then the supporting
 * ones (smaller). One component wherever key numbers appear, so they always look the same.
 */
export function KeyNumbers({
  version,
  grinderName,
  label = 'Key numbers',
}: Readonly<{ version: KeyStatsVersion; grinderName?: string; label?: string }>) {
  const { weight, temp, duration, units } = useUnits();
  const { primary, secondary } = keyStats(version, grinderName, {
    weight,
    temp,
    duration,
    tempUnit: units.temp_unit,
  });
  return (
    <div className={styles.card} role="group" aria-label={label} data-testid="key-numbers">
      <dl className={`${styles.grid} ${styles.primary}`}>
        {primary.map((s) => (
          <Stat key={s.label} stat={s} />
        ))}
      </dl>
      {secondary.length > 0 ? (
        <dl className={`${styles.grid} ${styles.secondary}`}>
          {secondary.map((s) => (
            <Stat key={s.label} stat={s} />
          ))}
        </dl>
      ) : null}
    </div>
  );
}
