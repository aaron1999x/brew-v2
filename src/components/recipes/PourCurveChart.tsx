'use client';

import { useId, useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ChartLegend, type LegendItem } from '@/components/charts/ChartLegend';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { Marker, seriesStyles, type MarkerKind } from '@/components/charts/series';
import {
  curveEnd,
  curveLine,
  curveMarkers,
  curveRows,
  curveSamples,
  firstPourStart,
  readCurveAt,
  timeTicks,
  weightTicks,
} from '@/lib/recipes/curve';
import { STEP_KIND_LABELS, type StepData, type StepKind } from '@/lib/recipes/steps';
import { useUnits } from '@/lib/settings/useSettings';
import { WEIGHT_DECIMALS, WEIGHT_LABEL, weightToDisplay } from '@/lib/units';
import { useReducedMotion } from '@/lib/ui/useReducedMotion';
import styles from './PourCurveChart.module.css';

export type CurveSeries = {
  id: string;
  /** "v2": names the series in the legend, the tooltip and the table. */
  label: string;
  steps: readonly StepData[];
};

type Props = Readonly<{
  /** One series for a recipe page; two to overlay versions on the compare page. */
  series: readonly CurveSeries[];
  /** Target drawdown window in seconds. */
  drawdown?: { from: number; to: number } | null;
  title?: string;
}>;

/** Each kind of step has its own shape, so the markers read without colour. */
const MARKER_FOR_KIND: Record<Exclude<StepKind, 'pour'>, MarkerKind> = {
  wait: 'square',
  swirl: 'diamond',
  stir: 'triangle',
  press: 'circle',
  other: 'circle',
};

/** How close (as a share of the chart's width) a pointer counts as "at" a pour's start. */
const SNAP_SHARE = 0.015;

/**
 * Cumulative water (in the person's weight unit) against time: each pour is a ramp, filled underneath
 * with a soft gradient, and the other steps are marked on the line. A second version overlays as a
 * dashed line without a fill. The picture is one image to assistive technology, with the same data
 * as a table behind "Show data table". Loaded on demand (see LazyPourCurve).
 */
export function PourCurveChart({ series, drawdown, title = 'Pour curve' }: Props) {
  const { units, duration } = useUnits();
  const reduced = useReducedMotion();
  const gradientId = `pour-fill-${useId().replaceAll(':', '')}`;
  const unit = units.weight_unit;
  const unitLabel = WEIGHT_LABEL[unit];
  const toDisplay = (g: number) => weightToDisplay(g, unit);
  const formatWeight = (value: number) =>
    `${new Intl.NumberFormat(undefined, { maximumFractionDigits: WEIGHT_DECIMALS[unit] }).format(value)} ${unitLabel}`;

  const model = useMemo(() => {
    const endS = Math.max(...series.map((s) => curveEnd(s.steps)), drawdown ? drawdown.to : 0);
    const lines = series.map((s) => ({
      ...s,
      line: curveLine(s.steps, endS),
      pourStart: firstPourStart(s.steps),
      markers: curveMarkers(s.steps, endS).map((m) => ({ ...m, w: weightToDisplay(m.g, unit) })),
      rows: curveRows(s.steps),
    }));
    const samples = curveSamples(
      lines.map((l) => l.line),
      endS,
    );
    // One row per time. Each line is split in two: before its first pour it is only drawn faintly.
    const data = samples.map((row) => {
      const point: Record<string, number | null> = { t: row.t };
      lines.forEach((l, i) => {
        const w = weightToDisplay(row.g[i]!, unit);
        const started = l.pourStart !== null && row.t >= l.pourStart;
        point[`w${i}`] = started ? w : null;
        point[`pre${i}`] = l.pourStart === null || row.t <= l.pourStart ? w : null;
      });
      return point;
    });
    const top = Math.max(0, ...data.flatMap((p) => lines.map((_, i) => p[`w${i}`] ?? p[`pre${i}`] ?? 0)));
    return { endS, lines, data, y: weightTicks(top, unit), xTicks: timeTicks(endS) };
  }, [series, drawdown, unit]);

  const multiple = series.length > 1;
  const kindsPresent = [...new Set(model.lines.flatMap((l) => l.markers.map((m) => m.kind)))] as Exclude<
    StepKind,
    'pour'
  >[];
  const primary = seriesStyles[0]!;

  const legendItems: LegendItem[] = [
    ...series.map((s, i) => ({
      label: multiple ? `${s.label}: water poured` : 'Water poured',
      color: seriesStyles[i]?.color ?? primary.color,
      kind: 'line' as const,
      dash: seriesStyles[i]?.dash,
      marker: multiple ? seriesStyles[i]?.marker : undefined,
    })),
    ...kindsPresent.map((kind) => ({
      label: STEP_KIND_LABELS[kind],
      color: primary.color,
      kind: 'marker' as const,
      marker: MARKER_FOR_KIND[kind],
    })),
    ...(drawdown
      ? [{ label: 'Target drawdown', color: 'var(--color-chart-target-band)', kind: 'area' as const }]
      : []),
  ];

  const tableRows = model.lines.flatMap((l) =>
    l.rows.map((r) => [
      ...(multiple ? [l.label] : []),
      r.label,
      duration(r.t),
      formatWeight(toDisplay(r.g)),
    ]),
  );

  const describeEnd = model.lines
    .map((l) => {
      const last = l.line[l.line.length - 1]!;
      return `${multiple ? `${l.label} ` : ''}ends at ${formatWeight(toDisplay(last.g))}`;
    })
    .join('; ');

  return (
    <ChartContainer
      title={title}
      description={`Water poured over ${duration(model.endS)}${multiple ? ` for ${series.map((s) => s.label).join(' and ')}` : ''}; ${describeEnd}.${
        drawdown
          ? ` Target drawdown between ${duration(drawdown.from)} and ${duration(drawdown.to)}.`
          : ''
      } The data is in the table below.`}
      size="lg"
      table={{
        caption: `Steps: time and cumulative water in ${unitLabel === 'g' ? 'grams' : 'ounces'}`,
        columns: [...(multiple ? ['Version'] : []), 'Step', 'Time', 'Water'],
        rows: tableRows,
      }}
      legend={<ChartLegend items={legendItems} />}
    >
      <ComposedChart
        data={model.data}
        margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
        accessibilityLayer={false}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primary.color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={primary.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="var(--color-chart-grid)"
          strokeOpacity={0.6}
        />
        <XAxis
          type="number"
          dataKey="t"
          domain={[0, model.endS]}
          allowDataOverflow
          ticks={model.xTicks}
          interval={0}
          tickFormatter={(t: number) => duration(t)}
          tickLine={false}
          axisLine={{ stroke: 'var(--color-border-strong)' }}
        />
        <YAxis
          type="number"
          domain={[0, model.y.top]}
          ticks={model.y.ticks}
          interval={0}
          tickFormatter={(v: number) => `${v} ${unitLabel}`}
          tickLine={false}
          axisLine={false}
          width={54}
        />
        {drawdown ? (
          <ReferenceArea
            x1={drawdown.from}
            x2={drawdown.to}
            fill="var(--color-chart-target-band)"
            fillOpacity={0.25}
            stroke="var(--color-chart-target-band)"
            strokeDasharray="4 3"
          />
        ) : null}
        {model.lines.map((line, i) => {
          const style = seriesStyles[i] ?? primary;
          return (
            <Line
              key={`pre-${line.id}`}
              dataKey={`pre${i}`}
              name={`${line.label} before the first pour`}
              type="linear"
              stroke={style.color}
              strokeOpacity={0.35}
              strokeWidth={1.5}
              strokeDasharray={style.dash}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              legendType="none"
            />
          );
        })}
        {model.lines.map((line, i) =>
          i === 0 ? (
            <Area
              key={line.id}
              dataKey="w0"
              name={line.label}
              type="linear"
              stroke={primary.color}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              fillOpacity={1}
              baseValue={0}
              dot={false}
              activeDot={false}
              isAnimationActive={!reduced}
            />
          ) : (
            <Line
              key={line.id}
              dataKey={`w${i}`}
              name={line.label}
              type="linear"
              stroke={(seriesStyles[i] ?? primary).color}
              strokeDasharray={(seriesStyles[i] ?? primary).dash}
              strokeWidth={2.5}
              dot={false}
              activeDot={false}
              isAnimationActive={!reduced}
            />
          ),
        )}
        {model.lines.flatMap((line, i) => {
          const style = seriesStyles[i] ?? primary;
          return line.markers.map((m) => (
            <ReferenceDot
              key={`${line.id}-${m.stepId}`}
              x={m.t}
              y={m.w}
              ifOverflow="visible"
              shape={(p: { cx?: number; cy?: number }) => (
                <g>
                  <Marker
                    kind={MARKER_FOR_KIND[m.kind as Exclude<StepKind, 'pour'>]}
                    cx={p.cx ?? 0}
                    cy={p.cy ?? 0}
                    color={style.color}
                    size={6}
                  />
                  {multiple ? null : (
                    <text x={(p.cx ?? 0) + 9} y={(p.cy ?? 0) - 9} className={styles.markerLabel}>
                      {m.label}
                    </text>
                  )}
                </g>
              )}
            />
          ));
        })}
        <Tooltip
          isAnimationActive={false}
          cursor={{ stroke: 'var(--color-border-strong)', strokeWidth: 1 }}
          content={(p) => {
            const like = p as unknown as { active?: boolean; label?: number | string };
            const hovered = Number(like.label);
            if (!like.active || !Number.isFinite(hovered)) return null;
            const snapS = model.endS * SNAP_SHARE;
            const readings = model.lines.map((l) => readCurveAt(l.steps, l.line, hovered, snapS));
            const first = readings[0]!;
            // One version: "1:10 · 90 g". Two: the time, and a row for each.
            if (!multiple) {
              return (
                <ChartTooltip
                  active
                  title={`${duration(first.t)} · ${formatWeight(toDisplay(first.g))}`}
                />
              );
            }
            return (
              <ChartTooltip
                active
                title={duration(first.pourId ? first.t : hovered)}
                payload={readings.map((r, i) => ({
                  name: model.lines[i]!.label,
                  value: formatWeight(toDisplay(r.g)),
                }))}
              />
            );
          }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
