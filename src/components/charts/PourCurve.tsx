'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useReducedMotion } from '@/lib/ui/useReducedMotion';
import { ChartContainer } from './ChartContainer';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip, type TooltipLike } from './ChartTooltip';
import { Marker, seriesStyles, type MarkerKind } from './series';

export type PourStep =
  | { type: 'pour'; start: number; end: number; to: number; label?: string }
  | { type: 'swirl' | 'wait'; at: number; label?: string };

type Props = {
  steps: readonly PourStep[];
  /** Target drawdown window in seconds. */
  targetDrawdown?: { from: number; to: number };
  /** Total time shown on the x axis. */
  duration: number;
};

const markerFor: Record<'swirl' | 'wait', { kind: MarkerKind; label: string }> = {
  swirl: { kind: 'diamond', label: 'Swirl' },
  wait: { kind: 'square', label: 'Wait' },
};

/** Water poured so far at time `t`, following the steps. */
function waterAt(steps: readonly PourStep[], t: number): number {
  let water = 0;
  for (const s of steps) {
    if (s.type !== 'pour') continue;
    if (t >= s.end) water = s.to;
    else if (t > s.start) {
      const before = water;
      return before + ((s.to - before) * (t - s.start)) / (s.end - s.start);
    }
  }
  return water;
}

/** Cumulative water (g) over time (s), with swirl and wait markers and a target drawdown band. */
export function PourCurve({ steps, targetDrawdown, duration }: Props) {
  const reduced = useReducedMotion();
  const a = seriesStyles[0]!;

  // Curve points: the start and end of each pour, plus the end of the brew.
  const points: { t: number; water: number }[] = [{ t: 0, water: 0 }];
  let cumulative = 0;
  for (const s of steps) {
    if (s.type !== 'pour') continue;
    points.push({ t: s.start, water: cumulative }, { t: s.end, water: s.to });
    cumulative = s.to;
  }
  points.push({ t: duration, water: cumulative });

  const marks = steps.flatMap((s) =>
    s.type === 'pour' ? [] : [{ t: s.at, water: waterAt(steps, s.at), type: s.type }],
  );

  const rows = steps.map((s) =>
    s.type === 'pour'
      ? [s.label ?? 'Pour', `${s.start}–${s.end}`, s.to]
      : [markerFor[s.type].label, s.at, waterAt(steps, s.at)],
  );

  return (
    <ChartContainer
      title="Pour curve"
      description={`Water poured over ${duration} seconds, rising to ${cumulative} grams, with swirls and waits marked${
        targetDrawdown
          ? ` and a target drawdown between ${targetDrawdown.from} and ${targetDrawdown.to} seconds`
          : ''
      }.`}
      size="lg"
      table={{
        caption: 'Pour steps: time in seconds and cumulative water in grams',
        columns: ['Step', 'Time (s)', 'Water (g)'],
        rows,
      }}
      legend={
        <ChartLegend
          items={[
            { label: 'Water poured', color: a.color, kind: 'line' },
            { label: 'Swirl', color: a.color, kind: 'marker', marker: 'diamond' },
            { label: 'Wait', color: a.color, kind: 'marker', marker: 'square' },
            ...(targetDrawdown
              ? [
                  {
                    label: 'Target drawdown',
                    color: 'var(--color-chart-target-band)',
                    kind: 'area' as const,
                  },
                ]
              : []),
          ]}
        />
      }
    >
      <LineChart
        data={points}
        margin={{ top: 12, right: 16, bottom: 20, left: 0 }}
        accessibilityLayer={false}
      >
        <CartesianGrid stroke="var(--color-chart-grid)" vertical={false} />
        <XAxis
          type="number"
          dataKey="t"
          domain={[0, duration]}
          tickCount={7}
          tickLine={false}
          axisLine={{ stroke: 'var(--color-border-strong)' }}
          label={{ value: 'Time (s)', position: 'insideBottom', offset: -12 }}
        />
        <YAxis
          type="number"
          domain={[0, Math.ceil(cumulative / 50) * 50]}
          tickLine={false}
          axisLine={false}
          width={40}
          label={{ value: 'Water (g)', angle: -90, position: 'insideLeft', offset: 10 }}
        />
        {targetDrawdown ? (
          <ReferenceArea
            x1={targetDrawdown.from}
            x2={targetDrawdown.to}
            fill="var(--color-chart-target-band)"
            fillOpacity={0.25}
            stroke="var(--color-chart-target-band)"
            strokeDasharray="4 3"
          />
        ) : null}
        <Line
          type="linear"
          dataKey="water"
          name="Water (g)"
          stroke={a.color}
          strokeWidth={2.5}
          dot={false}
          activeDot={false}
          isAnimationActive={!reduced}
        />
        {marks.map((m) => (
          <ReferenceDot
            key={`${m.type}-${m.t}`}
            x={m.t}
            y={m.water}
            ifOverflow="visible"
            shape={(p: { cx?: number; cy?: number }) => (
              <Marker
                kind={markerFor[m.type].kind}
                cx={p.cx ?? 0}
                cy={p.cy ?? 0}
                color={a.color}
                size={6}
              />
            )}
          />
        ))}
        <Tooltip
          isAnimationActive={false}
          content={(p) => (
            <ChartTooltip
              {...(p as unknown as TooltipLike)}
              title={`${(p as unknown as { label?: number }).label ?? ''} s`}
            />
          )}
        />
      </LineChart>
    </ChartContainer>
  );
}
