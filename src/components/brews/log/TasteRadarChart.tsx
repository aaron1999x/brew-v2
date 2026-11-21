'use client';

import { SensoryRadar } from '@/components/charts/SensoryRadar';
import { TASTE_KEYS, TASTE_LABELS } from '@/lib/brews/schema';

export type TasteSeries = {
  key: string;
  name: string;
  /** Eight scores in `TASTE_KEYS` order; null = not scored. */
  values: readonly (number | null)[];
};

const ATTRIBUTES = TASTE_KEYS.map((k) => TASTE_LABELS[k]);

const format = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** One sentence per series for the text alternative: "Sweetness 7.0, acidity not scored, …". */
export function describeScores(values: readonly (number | null)[]): string {
  return TASTE_KEYS.map(
    (key, i) => `${TASTE_LABELS[key].toLowerCase()} ${values[i] == null ? 'not scored' : format.format(values[i]!)}`,
  ).join(', ');
}

/** The eight taste scores as a radar, with its table alternative. Loaded on demand (see LazyTasteRadar). */
export function TasteRadarChart({
  series,
  title = 'Taste',
}: Readonly<{ series: readonly TasteSeries[]; title?: string }>) {
  return (
    <SensoryRadar
      title={title}
      description={`Scores out of 10 on eight axes. ${series
        .map((s) => `${series.length > 1 ? `${s.name}: ` : ''}${describeScores(s.values)}.`)
        .join(' ')}`}
      attributes={ATTRIBUTES}
      series={series}
    />
  );
}
