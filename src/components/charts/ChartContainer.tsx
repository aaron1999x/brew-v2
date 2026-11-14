'use client';

import type { ReactElement, ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { cx } from '@/lib/cx';
import styles from './Chart.module.css';

export type ChartTable = {
  caption: string;
  columns: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<string | number>>;
};

type Props = {
  title: string;
  /** One or two sentences saying what the chart shows: the text alternative for the picture. */
  description: string;
  /** The same data as text. Also available behind "Show data table". */
  table: ChartTable;
  legend?: ReactNode;
  size?: 'md' | 'lg';
  /** A Recharts chart element, e.g. <RadarChart>. */
  children: ReactElement;
};

/**
 * Frame for a Recharts chart, modelled on shadcn/ui's ChartContainer: a titled figure with a
 * responsive plot area, an HTML legend and a tooltip card. The picture is one image to assistive
 * technology (named by `description`); the data table behind the toggle is the real alternative.
 */
export function ChartContainer({
  title,
  description,
  table,
  legend,
  size = 'md',
  children,
}: Props) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div
        role="img"
        aria-label={`${title}. ${description}`}
        className={cx(styles.plot, size === 'lg' && styles.plotLarge)}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
      {legend}
      <details className={styles.details}>
        <summary className={styles.summary}>Show data table</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.caption}>{table.caption}</caption>
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) =>
                    j === 0 ? (
                      <th key={j} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={j} className="num">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
