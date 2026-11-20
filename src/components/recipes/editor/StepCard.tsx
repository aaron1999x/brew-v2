'use client';

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { DurationField } from '@/components/ui/UnitFields/DurationField';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { RateField } from '@/components/ui/UnitFields/RateField';
import { TemperatureField } from '@/components/ui/UnitFields/TemperatureField';
import { TextField } from '@/components/ui/TextField/TextField';
import { WeightField } from '@/components/ui/UnitFields/WeightField';
import { stepFieldId } from '@/lib/recipes/draft';
import { LIMITS } from '@/lib/recipes/schema';
import { LABEL_MAX, TECHNIQUE_MAX, stepHeading, type StepData } from '@/lib/recipes/steps';
import { useUnits } from '@/lib/settings/useSettings';
import styles from './Steps.module.css';

type Props = {
  steps: readonly StepData[];
  index: number;
  varyTemp: boolean;
  /** "+X g this pour" for pours, from the cumulative targets. */
  poured: number | undefined;
  errors: Readonly<Record<string, string>>;
  onChange: (patch: Partial<StepData>) => void;
  onMove: (direction: 'up' | 'down') => void;
  onDelete: () => void;
};

export const stepHeadingId = (id: string) => `step-${id}-heading`;
export const stepMoveId = (id: string, direction: 'up' | 'down') => `step-${id}-${direction}`;

/**
 * One step of the recipe. The heading and group name read "Step 3 · Pour · 1:10"; the time is
 * m:ss, or h:mm:ss from one hour. Reorder and delete are 44 px buttons (no dragging).
 */
export function StepCard({
  steps,
  index,
  varyTemp,
  poured,
  errors,
  onChange,
  onMove,
  onDelete,
}: Props) {
  const { weight } = useUnits();
  const step = steps[index]!;
  const heading = stepHeading(steps, index);
  const err = (field: string) => errors[stepFieldId(step.id, field)];
  const n = index + 1;

  // From 768 px a pour's time, target, rate (and temperature) share one row.
  const fieldsClass = `${styles.fields} ${
    step.kind === 'pour'
      ? varyTemp
        ? styles.fieldsPour4
        : styles.fieldsPour3
      : step.kind === 'other'
        ? styles.fieldsPour3
        : ''
  }`;

  return (
    <fieldset className={styles.card} aria-label={heading.accessible}>
      <div className={styles.header}>
        <h3 id={stepHeadingId(step.id)} tabIndex={-1} className={styles.heading}>
          {heading.visible}
        </h3>
        <div className={styles.tools}>
          <IconButton
            id={stepMoveId(step.id, 'up')}
            icon={ArrowUp}
            label={`Move step ${n} up`}
            isDisabled={index === 0}
            onPress={() => onMove('up')}
          />
          <IconButton
            id={stepMoveId(step.id, 'down')}
            icon={ArrowDown}
            label={`Move step ${n} down`}
            isDisabled={index === steps.length - 1}
            onPress={() => onMove('down')}
          />
          <IconButton icon={Trash2} label={`Delete step ${n}`} onPress={onDelete} />
        </div>
      </div>

      <div className={fieldsClass}>
        <DurationField
          id={stepFieldId(step.id, 'at_s')}
          label="Time"
          description="From the start of the brew"
          isRequired
          value={step.at_s}
          onChange={(seconds) => onChange({ at_s: seconds ?? 0 })}
          errorMessage={err('at_s')}
        />

        {step.kind === 'pour' ? (
          <>
            <WeightField
              id={stepFieldId(step.id, 'target_g')}
              label="Scale reads after pouring"
              description={
                poured != null ? `+${weight(poured)} this pour` : 'The total water poured so far'
              }
              isRequired
              value={step.target_g ?? null}
              min={0}
              onChange={(grams) => onChange({ target_g: grams })}
              isInvalid={Boolean(err('target_g'))}
              errorMessage={err('target_g')}
            />
            <RateField
              id={stepFieldId(step.id, 'rate_gps')}
              label="Pour rate (optional)"
              value={step.rate_gps ?? null}
              min={0}
              onChange={(rate) => onChange({ rate_gps: rate })}
              isInvalid={Boolean(err('rate_gps'))}
              errorMessage={err('rate_gps')}
            />
            {varyTemp ? (
              <TemperatureField
                id={stepFieldId(step.id, 'temp_c')}
                label="Temperature (optional)"
                value={step.temp_c ?? null}
                min={0}
                max={LIMITS.tempC}
                onChange={(temp) => onChange({ temp_c: temp })}
                isInvalid={Boolean(err('temp_c'))}
                errorMessage={err('temp_c')}
              />
            ) : null}
          </>
        ) : (
          <>
            {step.kind === 'other' ? (
              <TextField
                id={stepFieldId(step.id, 'label')}
                label="Label"
                placeholder="e.g. Close valve"
                isRequired
                maxLength={LABEL_MAX}
                value={step.label ?? ''}
                onChange={(label) => onChange({ label })}
                isInvalid={Boolean(err('label'))}
                errorMessage={err('label')}
              />
            ) : null}
            <DurationField
              id={stepFieldId(step.id, 'duration_s')}
              label="Duration (optional)"
              value={step.duration_s ?? null}
              onChange={(seconds) => onChange({ duration_s: seconds })}
              errorMessage={err('duration_s')}
            />
          </>
        )}

        <div className={styles.technique}>
          <TextField
            id={stepFieldId(step.id, 'technique')}
            label="Technique (optional)"
            placeholder={
              step.kind === 'pour'
                ? 'e.g. slow spiral, centre only'
                : 'e.g. gentle, 3 clockwise turns'
            }
            maxLength={TECHNIQUE_MAX}
            value={step.technique ?? ''}
            onChange={(technique) => onChange({ technique })}
            errorMessage={err('technique')}
          />
        </div>
      </div>
    </fieldset>
  );
}
