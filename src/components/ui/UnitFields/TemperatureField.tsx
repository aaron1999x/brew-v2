'use client';

import { TEMP_DECIMALS, TEMP_LABEL, tempFromDisplay, tempToDisplay } from '@/lib/units';
import { MetricField, type MetricFieldProps, type MetricKind } from './MetricField';

const kind: MetricKind = {
  decimals: () => TEMP_DECIMALS,
  label: (u) => TEMP_LABEL[u.temp_unit],
  toDisplay: (c, u) => tempToDisplay(c, u.temp_unit),
  fromDisplay: (shown, u) => tempFromDisplay(shown, u.temp_unit),
};

/** A temperature input. Takes and emits °C; shows °C or °F by the user's setting. */
export function TemperatureField(props: MetricFieldProps) {
  return <MetricField {...props} kind={kind} />;
}
