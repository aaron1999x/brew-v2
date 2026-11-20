'use client';

import { RATE_DECIMALS, RATE_LABEL, rateFromDisplay, rateToDisplay } from '@/lib/units';
import { MetricField, type MetricFieldProps, type MetricKind } from './MetricField';

const kind: MetricKind = {
  decimals: (u) => RATE_DECIMALS[u.weight_unit],
  label: (u) => RATE_LABEL[u.weight_unit],
  toDisplay: (gps, u) => rateToDisplay(gps, u.weight_unit),
  fromDisplay: (shown, u) => rateFromDisplay(shown, u.weight_unit),
};

/** A pour-rate input. Takes and emits g/s; shows g/s or oz/s by the user's weight setting. */
export function RateField(props: MetricFieldProps) {
  return <MetricField {...props} kind={kind} />;
}
