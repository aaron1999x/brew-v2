'use client';

import { useMemo } from 'react';
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
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ChartLegend, type LegendItem } from '@/components/charts/ChartLegend';
import { ChartTooltip, type TooltipLike } from '@/components/charts/ChartTooltip';
import { Marker, seriesStyles, type MarkerKind } from '@/components/charts/series';
import { curveEnd, curveLine, curveMarkers, curveRows, niceMax } from '@/lib/recipes/curve';
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

type Props = {
  /** One series for a recipe page; two to overlay versions on the compare page. */
  series: readonly CurveSeries[];
  /** Target drawdown window in seconds. */
  drawdown?: { from: number; to: number } | null;
  title?: string;
};

/** Each kind of step has its own shape, so the markers read without colour. */
const MARKER_FOR_KIND: Record<Exclude<StepKind, 'pour'>, MarkerKind> = {
  wait: 'square',
  swirl: 'diamond',
  stir: 'triangle',
  press: 'circle',
  other: 'circle',
};

/**
 * Cumulative water (in the person's weight unit) against time (m:ss): a line that rises at each
 * pour, and the other steps marked on it. The picture is one image to assistive technology, with the
 * same data as a table behind "Show data table". Loaded on demand (see LazyPourCurve).
 */
export function PourCurveChart({ series, drawdown, title = 'Pour curve' }: Props) {
  const { units, duration } = useUnits();
  const reduced = useReducedMotion();
  const unit = units.weight_unit;
  const unitLabel = WEIGHT_LABEL[unit];
  const toDisplay = (g: number) => weightToDisplay(g, unit);
  const formatWeight = (value: number) =>
    `${new Intl.NumberFormat(undefined, { maximumFractionDigits: WEIGHT_DECIMALS[unit] }).format(value)} ${unitLabel}`;

  const model = useMemo(() => {
    const endS = Math.max(
      ...series.map((s) => curveEnd(s.steps)),
      drawdown ? drawdown.to : 0,
    );
    const lines = series.map((s) => ({
      ...s,
      points: curveLine(s.steps, endS).map((p) => ({ t: p.t, w: toDisplay(p.g) })),
      markers: curveMarkers(s.steps).map((m) => ({ ...m, w: toDisplay(m.g) })),
      rows: curveRows(s.steps),
    }));
    const top = Math.max(0, ...lines.flatMap((l) => l.points.map((p) => p.w)));
    return { endS, lines, yMax: niceMax(top, unit === 'oz' ? 2 : 50) };
    // `toDisplay` only depends on the unit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, drawdown, unit]);

  const multiple = series.length > 1;
  const kindsPresent = [
    ...new Set(model.lines.flatMap((l) => l.markers.map((m) => m.kind))),
  ] as Exclude<StepKind, 'pour'>[];

  const legendItems: LegendItem[] = [
    ...series.map((s, i) => ({
      label: multiple ? `${s.label}: water poured` : 'Water poured',
      color: seriesStyles[i]?.color ?? seriesStyles[0]!.color,
      kind: 'line' as const,
      dash: seriesStyles[i]?.dash,
      marker: multiple ? seriesStyles[i]?.marker : undefined,
    })),
    ...kindsPresent.map((kind) => ({
      label: STEP_KIND_LABELS[kind],
      color: seriesStyles[0]!.color,
      kind: 'marker' as const,
      marker: MARKER_FOR_KIND[kind],
    })),
    ...(drawdown
      ? [
          {
            label: 'Target drawdown',
            color: 'var(--color-chart-target-band)',
            kind: 'area' as const,
          },
        ]
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
      const last = l.points[l.points.length - 1]!;
      return `${multiple ? `${l.label} ` : ''}ends at ${formatWeight(last.w)}`;
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
      <LineChart margin={{ top: 12, right: 16, bottom: 20, left: 0 }} accessibilityLayer={false}>
        <CartesianGrid stroke="var(--color-chart-grid)" vertical={false} />
        <XAxis
          type="number"
          dataKey="t"
          domain={[0, model.endS]}
          allowDataOverflow
          tickCount={6}
          tickFormatter={(t: number) => duration(t)}
          tickLine={false}
          axisLine={{ stroke: 'var(--color-border-strong)' }}
          label={{ value: 'Time', position: 'insideBottom', offset: -12 }}
        />
        <YAxis
          type="number"
          dataKey="w"
          domain={[0, model.yMax]}
          tickLine={false}
          axisLine={false}
          width={44}
          label={{ value: `Water (${unitLabel})`, angle: -90, position: 'insideLeft', offset: 10 }}
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
          const style = seriesStyles[i] ?? seriesStyles[0]!;
          return (
            <Line
              key={line.id}
              data={line.points}
              dataKey="w"
              name={line.label}
              type="linear"
              stroke={style.color}
              strokeDasharray={style.dash}
              strokeWidth={2.5}
              dot={false}
              activeDot={false}
              isAnimationActive={!reduced}
            />
          );
        })}
        {model.lines.flatMap((line, i) => {
          const style = seriesStyles[i] ?? seriesStyles[0]!;
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
                  {!multiple ? (
                    <text x={(p.cx ?? 0) + 9} y={(p.cy ?? 0) - 9} className={styles.markerLabel}>
                      {m.label}
                    </text>
                  ) : null}
                </g>
              )}
            />
          ));
        })}
        <Tooltip
          isAnimationActive={false}
          cursor={false}
          content={(p) => {
            const like = p as unknown as TooltipLike & { payload?: { payload?: { t: number } }[] };
            const t = like.payload?.[0]?.payload?.t;
            return (
              <ChartTooltip
                active={like.active}
                title={t == null ? undefined : duration(t)}
                payload={like.payload?.map((entry) => ({
                  name: (entry as { name?: string }).name,
                  value: formatWeight(Number((entry as { value?: number }).value ?? 0)),
                }))}
              />
            );
          }}
        />
      </LineChart>
    </ChartContainer>
  );
}
