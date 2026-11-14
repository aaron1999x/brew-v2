'use client';

import {
  CartesianGrid,
  ReferenceArea,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useReducedMotion } from '@/lib/ui/useReducedMotion';
import { ChartContainer } from './ChartContainer';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip, type TooltipLike } from './ChartTooltip';
import { Marker, seriesStyles } from './series';

export type ExtractionPoint = { name: string; ey: number; tds: number };

type Props = {
  points: readonly ExtractionPoint[];
  /** The target box: extraction yield % and TDS %. */
  target: { ey: readonly [number, number]; tds: readonly [number, number] };
};

/** TDS (%) against extraction yield (%), with a target box. Inside and outside use different markers. */
export function ExtractionScatter({ points, target }: Props) {
  const reduced = useReducedMotion();
  const inside = (p: ExtractionPoint) =>
    p.ey >= target.ey[0] &&
    p.ey <= target.ey[1] &&
    p.tds >= target.tds[0] &&
    p.tds <= target.tds[1];
  const hit = points.filter(inside);
  const miss = points.filter((p) => !inside(p));
  const [a, b] = [seriesStyles[0]!, seriesStyles[1]!];

  return (
    <ChartContainer
      title="TDS vs extraction"
      description={`${points.length} brews plotted by extraction yield and TDS; ${hit.length} fall inside the target box (extraction ${target.ey[0]} to ${target.ey[1]} percent, TDS ${target.tds[0]} to ${target.tds[1]} percent).`}
      size="lg"
      table={{
        caption: 'Brews: extraction yield and TDS, and whether they are inside the target',
        columns: ['Brew', 'Extraction (%)', 'TDS (%)', 'Target'],
        rows: points.map((p) => [p.name, p.ey, p.tds, inside(p) ? 'Inside' : 'Outside']),
      }}
      legend={
        <ChartLegend
          items={[
            { label: 'Inside target', color: a.color, kind: 'marker', marker: a.marker },
            { label: 'Outside target', color: b.color, kind: 'marker', marker: b.marker },
            { label: 'Target box', color: 'var(--color-chart-target-band)', kind: 'area' },
          ]}
        />
      }
    >
      <ScatterChart margin={{ top: 12, right: 16, bottom: 20, left: 0 }} accessibilityLayer={false}>
        <CartesianGrid stroke="var(--color-chart-grid)" />
        <XAxis
          type="number"
          dataKey="ey"
          name="Extraction"
          unit="%"
          domain={[16, 24]}
          tickCount={5}
          tickLine={false}
          axisLine={{ stroke: 'var(--color-border-strong)' }}
          label={{ value: 'Extraction yield (%)', position: 'insideBottom', offset: -12 }}
        />
        <YAxis
          type="number"
          dataKey="tds"
          name="TDS"
          unit="%"
          domain={[1, 1.7]}
          tickCount={5}
          tickLine={false}
          axisLine={false}
          width={44}
          label={{ value: 'TDS (%)', angle: -90, position: 'insideLeft', offset: 10 }}
        />
        <ReferenceArea
          x1={target.ey[0]}
          x2={target.ey[1]}
          y1={target.tds[0]}
          y2={target.tds[1]}
          fill="var(--color-chart-target-band)"
          fillOpacity={0.25}
          stroke="var(--color-chart-target-band)"
          strokeDasharray="4 3"
        />
        <Scatter
          name="Inside target"
          data={hit}
          isAnimationActive={!reduced}
          shape={(p: { cx?: number; cy?: number }) => (
            <Marker kind={a.marker} cx={p.cx ?? 0} cy={p.cy ?? 0} color={a.color} size={6} />
          )}
        />
        <Scatter
          name="Outside target"
          data={miss}
          isAnimationActive={!reduced}
          shape={(p: { cx?: number; cy?: number }) => (
            <Marker kind={b.marker} cx={p.cx ?? 0} cy={p.cy ?? 0} color={b.color} size={6} />
          )}
        />
        <Tooltip
          isAnimationActive={false}
          cursor={false}
          content={(p) => <ChartTooltip {...(p as unknown as TooltipLike)} />}
        />
      </ScatterChart>
    </ChartContainer>
  );
}
