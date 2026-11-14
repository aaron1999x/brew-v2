'use client';

import { useMemo } from 'react';
import { Combobox } from '@/components/ui/Combobox/Combobox';
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl';
import {
  listTimeZones,
  previewLine,
  type DateFormat,
  type TempUnit,
  type TimeFormat,
  type UnitSettings,
  type WeightUnit,
} from '@/lib/units';
import styles from './Settings.module.css';

const TEMP = [
  { value: 'c', label: '°C' },
  { value: 'f', label: '°F' },
];
const WEIGHT = [
  { value: 'g', label: 'g' },
  { value: 'oz', label: 'oz' },
];
const DATES = [
  { value: 'dmy', label: 'Day first' },
  { value: 'mdy', label: 'Month first' },
  { value: 'ymd', label: 'Year first' },
];
const TIMES = [
  { value: '24h', label: '24-hour' },
  { value: '12h', label: '12-hour' },
];

type Props = {
  value: UnitSettings;
  onChange: (patch: Partial<UnitSettings>) => void;
};

/**
 * The unit and region controls with the live preview line, shared by /settings/units (each change
 * saves at once) and the onboarding step (changes are held until Continue).
 */
export function UnitsFields({ value, onChange }: Props) {
  const zones = useMemo(() => listTimeZones().map((z) => ({ id: z, label: z })), []);
  // A stored zone this browser doesn't list still needs to show up as selected.
  const items = zones.some((z) => z.id === value.time_zone)
    ? zones
    : [{ id: value.time_zone, label: value.time_zone }, ...zones];

  return (
    <div className={styles.form}>
      <p className={styles.preview} aria-live="polite" data-testid="units-preview">
        <span className={styles.previewLabel}>Preview</span>
        <span className="num">{previewLine(value)}</span>
      </p>
      <SegmentedControl
        label="Temperature"
        segments={TEMP}
        value={value.temp_unit}
        onChange={(v) => onChange({ temp_unit: v as TempUnit })}
      />
      <SegmentedControl
        label="Weight"
        segments={WEIGHT}
        value={value.weight_unit}
        onChange={(v) => onChange({ weight_unit: v as WeightUnit })}
      />
      <SegmentedControl
        label="Date order"
        segments={DATES}
        value={value.date_format}
        onChange={(v) => onChange({ date_format: v as DateFormat })}
      />
      <SegmentedControl
        label="Time"
        segments={TIMES}
        value={value.time_format}
        onChange={(v) => onChange({ time_format: v as TimeFormat })}
      />
      <Combobox
        label="Time zone"
        items={items}
        defaultSelectedId={value.time_zone}
        onSelect={(selection) => {
          if (selection.kind === 'item') onChange({ time_zone: selection.item.id });
        }}
      />
    </div>
  );
}
