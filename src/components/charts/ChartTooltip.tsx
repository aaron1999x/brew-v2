import type { ReactNode } from 'react';
import styles from './Chart.module.css';

type Entry = {
  name?: string | number;
  value?: string | number | ReadonlyArray<string | number>;
  color?: string;
  unit?: string | number;
};

export type TooltipLike = {
  active?: boolean;
  label?: string | number;
  payload?: readonly Entry[];
};

type Props = TooltipLike & {
  /** Heading override, e.g. "Sweetness". Defaults to the axis label. */
  title?: ReactNode;
};

/** The tooltip card: a title and one row per series. Shown on hover or touch. */
export function ChartTooltip({ active, payload, label, title }: Props) {
  if (!active || !payload?.length) return null;
  const heading = title ?? label;
  return (
    <div className={styles.tooltip}>
      {heading != null && heading !== '' ? <p className={styles.tooltipTitle}>{heading}</p> : null}
      <ul className={styles.tooltipRows}>
        {payload.map((entry, i) => (
          <li key={`${entry.name}-${i}`} className={styles.tooltipRow}>
            <span className={styles.tooltipName}>{entry.name}</span>
            <span className={styles.tooltipValue}>
              {Array.isArray(entry.value) ? entry.value.join(' – ') : entry.value}
              {entry.unit ? ` ${entry.unit}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
