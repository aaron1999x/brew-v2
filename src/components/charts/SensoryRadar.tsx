'use client';

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, Tooltip } from 'recharts';
import { useReducedMotion } from '@/lib/ui/useReducedMotion';
import { ChartContainer } from './ChartContainer';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip, type TooltipLike } from './ChartTooltip';
import { Marker, seriesStyles } from './series';

export type RadarSeries = {
  key: string;
  name: string;
  /** One value (0–10) per attribute, in the same order as `attributes`. */
  values: readonly number[];
};

type Props = {
  title: string;
  description: string;
  attributes: readonly string[];
  /** One to three series. With several, each gets its own line style and marker. */
  series: readonly RadarSeries[];
  /** Hide the legend when there is a single series. */
  showLegend?: boolean;
};

/** 0–10 radar. Up to three series, told apart by colour, line style and marker. */
export function SensoryRadar({ title, description, attributes, series, showLegend }: Props) {
  const reduced = useReducedMotion();
  const data = attributes.map((attribute, i) => {
    const row: Record<string, string | number> = { attribute };
    for (const s of series) row[s.key] = s.values[i] ?? 0;
    return row;
  });
  const multiple = series.length > 1;

  return (
    <ChartContainer
      title={title}
      description={description}
      size="lg"
      table={{
        caption: `${title}: score out of 10 for each attribute`,
        columns: ['Attribute', ...series.map((s) => s.name)],
        rows: attributes.map((a, i) => [a, ...series.map((s) => s.values[i] ?? 0)]),
      }}
      legend={
        (showLegend ?? multiple) ? (
          <ChartLegend
            items={series.map((s, i) => ({
              label: s.name,
              color: seriesStyles[i % 3]!.color,
              dash: seriesStyles[i % 3]!.dash,
              marker: seriesStyles[i % 3]!.marker,
            }))}
          />
        ) : undefined
      }
    >
      <RadarChart data={data} outerRadius="70%" accessibilityLayer={false}>
        <PolarGrid stroke="var(--color-chart-grid)" />
        <PolarAngleAxis dataKey="attribute" />
        <PolarRadiusAxis domain={[0, 10]} tickCount={6} angle={90} axisLine={false} tick={false} />
        {series.map((s, i) => {
          const style = seriesStyles[i % 3]!;
          return (
            <Radar
              key={s.key}
              name={s.name}
              dataKey={s.key}
              stroke={style.color}
              strokeWidth={2}
              strokeDasharray={style.dash}
              fill={style.color}
              fillOpacity={multiple ? 0.06 : 0.2}
              isAnimationActive={!reduced}
              dot={(p: { cx?: number; cy?: number; index?: number }) => (
                <Marker
                  key={p.index}
                  kind={style.marker}
                  cx={p.cx ?? 0}
                  cy={p.cy ?? 0}
                  color={style.color}
                  size={4}
                />
              )}
              activeDot={false}
            />
          );
        })}
        <Tooltip
          isAnimationActive={false}
          content={(p) => <ChartTooltip {...(p as unknown as TooltipLike)} />}
        />
      </RadarChart>
    </ChartContainer>
  );
}
