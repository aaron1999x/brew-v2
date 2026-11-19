'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { Notice } from '@/components/ui/Notice/Notice';
import { Switch } from '@/components/ui/Switch/Switch';
import { toast } from '@/components/ui/Toast/toast';
import { STEPS_ADD_ID, stepFieldId } from '@/lib/recipes/draft';
import {
  STEP_KINDS,
  STEP_KIND_LABELS,
  MAX_STEPS,
  clearPourTemperatures,
  defaultNewStep,
  insertStep,
  lastPourWarning,
  lastPourWarningMessage,
  moveStep,
  pourDeltas,
  removeStep,
  sortStepsByTime,
  stepLabel,
  totalTimeS,
  type StepContext,
  type StepData,
  type StepKind,
} from '@/lib/recipes/steps';
import { useUnits } from '@/lib/settings/useSettings';
import { StepCard, stepHeadingId, stepMoveId } from './StepCard';
import styles from './Steps.module.css';

type Props = {
  steps: readonly StepData[];
  onChange: (steps: StepData[]) => void;
  varyTemp: boolean;
  onVaryTempChange: (on: boolean) => void;
  /** Dose and brew water, for the defaults of a new pour and the last-pour warning. */
  context: StepContext;
  /** Error messages by field id (see `stepFieldId`). */
  errors: Readonly<Record<string, string>>;
};

/** Where focus goes after the next render (a moved, added or deleted step). */
type FocusTarget = { id: string };

/**
 * The steps of a recipe: pour, wait, swirl, stir, press and other, each with a time, and pours with
 * the scale weight they reach. Times are m:ss (h:mm:ss from one hour). Order is by buttons, not
 * dragging, so it works with a screen reader and one thumb.
 */
export function StepsEditor({
  steps,
  onChange,
  varyTemp,
  onVaryTempChange,
  context,
  errors,
}: Props) {
  const { weight, duration } = useUnits();
  const latest = useRef(steps);
  useEffect(() => {
    latest.current = steps;
  });
  const focusAfter = useRef<FocusTarget | null>(null);

  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    document.getElementById(target.id)?.focus();
  });

  const deltas = pourDeltas(steps);
  const warning = lastPourWarning(steps, context.brew_water_g);
  const total = totalTimeS(steps);
  const outOfOrder = steps.some((s, i) => i > 0 && s.at_s < steps[i - 1]!.at_s);

  function add(kind: StepKind) {
    const step = defaultNewStep(kind, steps, context);
    focusAfter.current = { id: stepFieldId(step.id, 'at_s') };
    onChange([...steps, step]);
  }

  function move(index: number, direction: 'up' | 'down') {
    const id = steps[index]!.id;
    const next = moveStep(steps, index, direction);
    // Keep focus on the same button; at the edge the other button takes over.
    const newIndex = next.findIndex((s) => s.id === id);
    const atEdge = direction === 'up' ? newIndex === 0 : newIndex === next.length - 1;
    focusAfter.current = { id: stepMoveId(id, atEdge ? (direction === 'up' ? 'down' : 'up') : direction) };
    onChange(next);
  }

  function remove(index: number) {
    const { steps: next, removed } = removeStep(steps, index);
    if (!removed) return;
    const neighbour = next[Math.min(index, next.length - 1)];
    focusAfter.current = { id: neighbour ? stepHeadingId(neighbour.id) : STEPS_ADD_ID };
    onChange(next);
    toast.undo(`Deleted ${stepLabel(steps, index).toLowerCase()}`, () =>
      onChange(insertStep(latest.current, index, removed)),
    );
  }

  return (
    <div className={styles.editor}>
      {steps.length === 0 ? (
        <p className={styles.empty}>
          No steps yet. A recipe without steps still works: the timer will be a simple stopwatch.
        </p>
      ) : (
        <>
          <Switch
            isSelected={varyTemp}
            onChange={(on) => {
              if (!on) onChange(clearPourTemperatures(steps));
              onVaryTempChange(on);
            }}
          >
            Vary temperature by pour
          </Switch>
          <ol className={styles.list}>
            {steps.map((step, index) => (
              <li key={step.id}>
                <StepCard
                  steps={steps}
                  index={index}
                  varyTemp={varyTemp}
                  poured={deltas.get(step.id)}
                  errors={errors}
                  onChange={(patch) =>
                    onChange(steps.map((s) => (s.id === step.id ? { ...s, ...patch } : s)))
                  }
                  onMove={(direction) => move(index, direction)}
                  onDelete={() => remove(index)}
                />
              </li>
            ))}
          </ol>
          {outOfOrder ? (
            <Button variant="secondary" onPress={() => onChange(sortStepsByTime(steps))}>
              Sort steps by time
            </Button>
          ) : null}
          {errors[STEPS_ADD_ID] ? (
            <p role="alert" className={styles.error}>
              {errors[STEPS_ADD_ID]}
            </p>
          ) : null}
          {warning ? <Notice>{lastPourWarningMessage(warning, weight)}</Notice> : null}
          {total != null ? (
            <p className={styles.total}>
              Total time <strong className="num">{duration(total)}</strong>
            </p>
          ) : null}
        </>
      )}

      <div role="group" aria-labelledby="add-step-title" className={styles.add}>
        <h3 id="add-step-title" className={styles.addTitle}>
          Add a step
        </h3>
        <div className={styles.kinds}>
          {STEP_KINDS.map((kind, i) => (
            <Button
              key={kind}
              id={i === 0 ? STEPS_ADD_ID : undefined}
              variant="secondary"
              isDisabled={steps.length >= MAX_STEPS}
              onPress={() => add(kind)}
            >
              {STEP_KIND_LABELS[kind]}
            </Button>
          ))}
        </div>
        {steps.length >= MAX_STEPS ? (
          <p className={styles.note}>A recipe can have up to {MAX_STEPS} steps.</p>
        ) : null}
      </div>
    </div>
  );
}
