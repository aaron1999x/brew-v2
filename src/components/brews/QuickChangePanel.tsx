'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { Icon } from '@/components/ui/Icon/Icon';
import { TextField } from '@/components/ui/TextField/TextField';
import { TemperatureField } from '@/components/ui/UnitFields/TemperatureField';
import { WeightField } from '@/components/ui/UnitFields/WeightField';
import { changeSummary } from '@/lib/brews/change-note';
import { isNoChange, type QuickChangeBase } from '@/lib/brews/quick-change';
import { BREW_LIMITS, type QuickChange } from '@/lib/brews/schema';
import { useUnits } from '@/lib/settings/useSettings';
import styles from './QuickChangePanel.module.css';

/** The grind setting is free text ("7.5", "2.5.0", "24 clicks"): a plain text keyboard, nothing auto-corrected. */
export const GRIND_INPUT_PROPS = {
  inputMode: 'text',
  autoCapitalize: 'none',
  autoCorrect: 'off',
  autoComplete: 'off',
  spellCheck: false,
} as const;

type Props = Readonly<{
  /** The version as saved (not as changed). */
  base: QuickChangeBase & { grinder?: string | null };
  change: QuickChange | null;
  onChange: (change: QuickChange | null) => void;
  /** The number the changed version would get: "Saves as v4 when you log this brew." */
  nextVersionNo: number;
}>;

/** The change with one field set (or removed when `value` is undefined); null when nothing is left. */
function withField<K extends keyof QuickChange>(
  change: QuickChange | null,
  key: K,
  value: QuickChange[K],
): QuickChange | null {
  const next: QuickChange = { ...change };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return Object.keys(next).length === 0 ? null : next;
}

/**
 * "Change for this brew": grind setting, temperature, dose and brew water. When the log is saved
 * the change becomes the next version. Closed until opened. Values that match the version again
 * are no change at all (no new version).
 */
export function QuickChangePanel({ base, change, onChange, nextVersionNo }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { units } = useUnits();
  const changed = !isNoChange(base, change);
  const summary = changed ? changeSummary(base, change, units) : '';

  return (
    <section className={styles.panel} aria-label="Change for this brew">
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        data-primary-control=""
      >
        <span className={styles.toggleText}>
          Change for this brew
          {changed ? <span className={styles.badge}>Changed</span> : null}
        </span>
        <span className={open ? styles.open : styles.chevron}>
          <Icon icon={ChevronDown} size="md" />
        </span>
      </button>

      <div id={panelId} hidden={!open} className={styles.fields}>
        <TextField
          label="Grind setting"
          description={base.grinder ? `Grinder: ${base.grinder}` : undefined}
          value={change?.grindSetting ?? base.grind_setting ?? ''}
          maxLength={BREW_LIMITS.grindMax}
          onChange={(text) => onChange(withField(change, 'grindSetting', text))}
          inputProps={GRIND_INPUT_PROPS}
        />
        <div className={styles.row}>
          <TemperatureField
            label="Temperature"
            value={change?.tempC ?? base.temp_c}
            min={0}
            max={100}
            onChange={(c) => onChange(withField(change, 'tempC', c ?? undefined))}
          />
          <WeightField
            label="Dose"
            value={change?.doseG ?? base.dose_g}
            min={0.1}
            max={BREW_LIMITS.doseMaxG}
            onChange={(g) => onChange(withField(change, 'doseG', g ?? undefined))}
          />
          <WeightField
            label="Brew water"
            value={change?.brewWaterG ?? base.brew_water_g}
            min={1}
            max={BREW_LIMITS.brewWaterMaxG}
            onChange={(g) => onChange(withField(change, 'brewWaterG', g ?? undefined))}
          />
        </div>

        <div className={styles.summary} aria-live="polite">
          {changed ? (
            <>
              <p className={styles.change}>{summary}</p>
              <p className={styles.hint}>Saves as v{nextVersionNo} when you log this brew.</p>
            </>
          ) : (
            <p className={styles.hint}>No change. This brew uses the version as it is.</p>
          )}
        </div>
        {change ? (
          <Button variant="secondary" size="sm" onPress={() => onChange(null)}>
            Reset
          </Button>
        ) : null}
      </div>
    </section>
  );
}
