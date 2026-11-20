'use client';

import { formatClock } from '@/lib/units';
import styles from './timer.module.css';

type Props = Readonly<{
  /** Seconds since the brew started. */
  elapsedS: number;
  /** The brew's length: where the last step ends. */
  totalS: number;
}>;

/**
 * The prototype's thin progress bar under the clock: elapsed ÷ total time. Named "0:31 of 1:15";
 * it is not a live region, so it never interrupts.
 */
export function TimerProgress({ elapsedS, totalS }: Props) {
  const total = Math.max(1, Math.floor(totalS));
  const done = Math.min(total, Math.max(0, Math.floor(elapsedS)));
  const text = `${formatClock(done)} of ${formatClock(total)}`;
  return (
    <div
      role="progressbar"
      aria-label={text}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={text}
      className={styles.progress}
    >
      <div className={styles.progressFill} style={{ width: `${(done / total) * 100}%` }} />
    </div>
  );
}
