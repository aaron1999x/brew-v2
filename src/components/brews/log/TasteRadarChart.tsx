'use client';

import { SensoryRadar } from '@/components/charts/SensoryRadar';
import { ATTRIBUTE_KEYS, TASTE_LABELS } from '@/lib/brews/schema';

export type TasteSeries = {
  key: string;
  name: string;
  /** The seven attribute scores in `ATTRIBUTE_KEYS` order; null = not scored (an older brew). */
  values: readonly (number | null)[];
  /** The headline score. It is not an axis, but the text alternative lists it. */
  overall: number | null;
};

const ATTRIBUTES = ATTRIBUTE_KEYS.map((k) => TASTE_LABELS[k]);

const format = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "Sweetness 7.0, acidity 5.0, …, overall 8.5": the scores in words, for the text alternative. */
export function describeScores(values: readonly (number | null)[], overall: number | null): string {
  const parts = ATTRIBUTE_KEYS.map(
    (key, i) => `${TASTE_LABELS[key].toLowerCase()} ${values[i] == null ? 'not scored' : format.format(values[i]!)}`,
  );
  parts.push(`overall ${overall == null ? 'not scored' : format.format(overall)}`);
  return parts.join(', ');
}

/** The seven taste attributes as a radar (overall is the headline number beside it), with a table alternative. */
export function TasteRadarChart({
  series,
  title = 'Taste',
}: Readonly<{ series: readonly TasteSeries[]; title?: string }>) {
  return (
    <SensoryRadar
      title={title}
      description={`Scores out of 10 on seven axes. ${series
        .map((s) => `${series.length > 1 ? `${s.name}: ` : ''}${describeScores(s.values, s.overall)}.`)
        .join(' ')}`}
      attributes={ATTRIBUTES}
      series={series}
      bare
      extraRows={[['Overall', ...series.map((s) => (s.overall == null ? 'Not scored' : s.overall))]]}
    />
  );
}
