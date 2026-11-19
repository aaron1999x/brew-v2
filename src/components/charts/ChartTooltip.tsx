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
  const heading = title ?? label;
  const hasHeading = heading != null && heading !== '';
  // Rows are optional: a tooltip can be just one line, like "1:10 · 90 g".
  if (!active || (!payload?.length && !hasHeading)) return null;
  return (
    <div className={styles.tooltip}>
      {hasHeading ? <p className={styles.tooltipTitle}>{heading}</p> : null}
      {payload?.length ? (
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
      ) : null}
    </div>
  );
}
