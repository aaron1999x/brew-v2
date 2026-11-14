'use client';

import { useUnits } from '@/lib/settings/useSettings';
import type { UnitSettings } from '@/lib/units';
import { NumberField, type NumberFieldProps, type Unit } from '../NumberField/NumberField';

export type MetricFieldProps = Omit<
  NumberFieldProps,
  'value' | 'defaultValue' | 'onChange' | 'unit' | 'minValue' | 'maxValue' | 'formatOptions'
> & {
  /** The stored metric value (°C or g), or null while empty. */
  value: number | null;
  /** Called with the metric value (or null when cleared) only when the person edits the field. */
  onChange: (metric: number | null) => void;
  /** Metric limits (°C or g); shown in the user's unit. */
  min?: number;
  max?: number;
  /** Show these units instead of the signed-in user's (the component gallery uses this). */
  units?: UnitPair;
};

export type UnitPair = Pick<UnitSettings, 'temp_unit' | 'weight_unit'>;

export type MetricKind = {
  decimals: (units: UnitPair) => number;
  label: (units: UnitPair) => Unit;
  toDisplay: (metric: number, units: UnitPair) => number;
  fromDisplay: (shown: number, units: UnitPair) => number;
};

/**
 * A NumberField that takes and gives metric values and shows the user's unit. It never calls
 * `onChange` for a value the person didn't type: opening, focusing or leaving the field leaves the
 * stored number exactly as it was, so converting and rounding can't make it drift.
 */
export function MetricField({
  kind,
  value,
  onChange,
  min,
  max,
  units: unitsProp,
  ...rest
}: MetricFieldProps & { kind: MetricKind }) {
  const { units: userUnits } = useUnits();
  const units = unitsProp ?? userUnits;
  const decimals = kind.decimals(units);
  const shown = value == null ? Number.NaN : kind.toDisplay(value, units);

  return (
    <NumberField
      {...rest}
      unit={kind.label(units)}
      value={shown}
      minValue={min == null ? undefined : kind.toDisplay(min, units)}
      maxValue={max == null ? undefined : kind.toDisplay(max, units)}
      formatOptions={{ maximumFractionDigits: decimals, useGrouping: false }}
      onChange={(next) => {
        if (Number.isNaN(next)) {
          if (value != null) onChange(null);
          return;
        }
        // Same number as the one on screen: the person didn't change it, so keep what's stored.
        if (value != null && next === shown) return;
        onChange(kind.fromDisplay(next, units));
      }}
    />
  );
}
