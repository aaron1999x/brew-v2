'use client';

import { WEIGHT_DECIMALS, WEIGHT_LABEL, weightFromDisplay, weightToDisplay } from '@/lib/units';
import { MetricField, type MetricFieldProps, type MetricKind } from './MetricField';

const kind: MetricKind = {
  decimals: (u) => WEIGHT_DECIMALS[u.weight_unit],
  label: (u) => WEIGHT_LABEL[u.weight_unit],
  toDisplay: (g, u) => weightToDisplay(g, u.weight_unit),
  fromDisplay: (shown, u) => weightFromDisplay(shown, u.weight_unit),
};

/** A weight input. Takes and emits grams; shows g or oz by the user's setting. */
export function WeightField(props: MetricFieldProps) {
  return <MetricField {...props} kind={kind} />;
}
