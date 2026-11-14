export type MarkerKind = 'circle' | 'square' | 'triangle' | 'diamond';

export type SeriesStyle = {
  /** A CSS colour value: always a token. */
  color: string;
  /** SVG dash pattern. Together with the marker it tells series apart without colour. */
  dash?: string;
  marker: MarkerKind;
};

/** Up to three overlaid series: colour, line style and marker all differ. */
export const seriesStyles: readonly SeriesStyle[] = [
  { color: 'var(--color-chart-series-a)', marker: 'circle' },
  { color: 'var(--color-chart-series-b)', dash: '6 4', marker: 'square' },
  { color: 'var(--color-chart-series-c)', dash: '2 4', marker: 'triangle' },
];

type MarkerProps = {
  kind: MarkerKind;
  cx: number;
  cy: number;
  color: string;
  size?: number;
};

/** A small filled shape centred on (cx, cy), with a surface-coloured outline so it reads on lines. */
export function Marker({ kind, cx, cy, color, size = 5 }: MarkerProps) {
  const common = { fill: color, stroke: 'var(--color-bg-surface)', strokeWidth: 1 };
  switch (kind) {
    case 'square':
      return <rect x={cx - size} y={cy - size} width={size * 2} height={size * 2} {...common} />;
    case 'triangle':
      return (
        <polygon
          points={`${cx},${cy - size - 1} ${cx + size + 1},${cy + size} ${cx - size - 1},${cy + size}`}
          {...common}
        />
      );
    case 'diamond':
      return (
        <polygon
          points={`${cx},${cy - size - 1} ${cx + size + 1},${cy} ${cx},${cy + size + 1} ${cx - size - 1},${cy}`}
          {...common}
        />
      );
    default:
      return <circle cx={cx} cy={cy} r={size} {...common} />;
  }
}
