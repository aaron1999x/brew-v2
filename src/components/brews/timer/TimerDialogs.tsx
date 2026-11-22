'use client';

import { Button } from '@/components/ui/Button/Button';
import { Sheet } from '@/components/ui/Sheet/Sheet';
import { missedStepText } from '@/lib/brews/describe';
import type { Cue } from '@/lib/brews/timer';
import type { StepData } from '@/lib/recipes/steps';
import { useUnits } from '@/lib/settings/useSettings';
import styles from './timer.module.css';

/**
 * "While you were away": the steps that came and went while the phone was locked or the app was in
 * the background. Closed with "Got it".
 */
export function MissedCuesDialog({
  cues,
  steps,
  onClose,
}: Readonly<{ cues: readonly Cue[]; steps: readonly StepData[]; onClose: () => void }>) {
  const { weight, duration } = useUnits();
  const lines = cues
    .map((cue) => (cue.stepIndex == null ? null : steps[cue.stepIndex]))
    .filter((step): step is StepData => step != null)
    .map((step) => missedStepText(step, weight, duration));
  return (
    <Sheet
      isOpen={lines.length > 0}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="While you were away"
      role="alertdialog"
      hideCloseButton
    >
      {(close) => (
        <div className={styles.dialogActions}>
          <ul className={styles.missed}>
            {lines.map((line, i) => (
              <li key={`${line}-${i}`}>{line}</li>
            ))}
          </ul>
          <Button size="lg" fullWidth onPress={close}>
            Got it
          </Button>
        </div>
      )}
    </Sheet>
  );
}

/** End brew: log what's been brewed, throw it away, or carry on. */
export function EndBrewDialog({
  isOpen,
  onOpenChange,
  onLogAnyway,
  onDiscard,
}: Readonly<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLogAnyway: () => void;
  onDiscard: () => void;
}>) {
  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title="End this brew?" role="alertdialog">
      {(close) => (
        <div className={styles.dialogActions}>
          <p className={styles.hint}>
            Log it anyway keeps this brew and opens the log, with no drawdown time. Discard throws it away.
          </p>
          <Button
            size="lg"
            fullWidth
            onPress={() => {
              close();
              onLogAnyway();
            }}
          >
            Log it anyway
          </Button>
          <Button
            size="lg"
            variant="destructive"
            fullWidth
            onPress={() => {
              close();
              onDiscard();
            }}
          >
            Discard
          </Button>
          <Button size="lg" variant="secondary" fullWidth onPress={close}>
            Keep brewing
          </Button>
        </div>
      )}
    </Sheet>
  );
}
