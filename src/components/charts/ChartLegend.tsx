import styles from './Chart.module.css';
import { Marker, type MarkerKind } from './series';

export type LegendItem = {
  label: string;
  color: string;
  /** `line` draws a (dashed) line with the marker on it; `area` draws a filled box. */
  kind?: 'line' | 'area' | 'marker';
  dash?: string;
  marker?: MarkerKind;
};

/** HTML legend. The swatch repeats the line style and marker, so colour is never the only cue. */
export function ChartLegend({ items }: { items: readonly LegendItem[] }) {
  return (
    <ul className={styles.legend} aria-label="Legend">
      {items.map((item) => (
        <li key={item.label} className={styles.legendItem}>
          <svg width="32" height="14" viewBox="0 0 32 14" aria-hidden="true" focusable="false">
            {item.kind === 'area' ? (
              <rect
                x="2"
                y="2"
                width="28"
                height="10"
                fill={item.color}
                fillOpacity="0.25"
                stroke={item.color}
                strokeDasharray="4 3"
              />
            ) : item.kind === 'marker' ? null : (
              <line
                x1="0"
                y1="7"
                x2="32"
                y2="7"
                stroke={item.color}
                strokeWidth="2"
                strokeDasharray={item.dash}
              />
            )}
            {item.marker ? (
              <Marker kind={item.marker} cx={16} cy={7} color={item.color} size={4} />
            ) : null}
          </svg>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
