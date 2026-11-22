import { STEP_KIND_LABELS, type StepData } from '@/lib/recipes/steps';
import { weightToDisplay, type WeightUnit } from '@/lib/units';

/** What a step is called: its kind ("Swirl"), or the label of an "other" step ("Close valve"). */
export function stepKindName(step: Pick<StepData, 'kind' | 'label'>): string {
  if (step.kind === 'other') return step.label?.trim() || STEP_KIND_LABELS.other;
  return STEP_KIND_LABELS[step.kind];
}

/** "150 grams" / "5.29 ounces": a weight in words, for screen readers. */
export function spokenWeight(grams: number, unit: WeightUnit): string {
  const value = weightToDisplay(grams, unit);
  const word = unit === 'oz' ? (value === 1 ? 'ounce' : 'ounces') : value === 1 ? 'gram' : 'grams';
  return `${value} ${word}`;
}

/** Announced when the current step changes: "Step 3, pour to 150 grams" or "Step 2, swirl". */
export function stepAnnouncement(steps: readonly StepData[], index: number, unit: WeightUnit): string {
  const step = steps[index];
  if (!step) return '';
  const n = `Step ${index + 1}`;
  if (step.kind === 'pour' && step.target_g != null) {
    return `${n}, pour to ${spokenWeight(step.target_g, unit)}`;
  }
  return `${n}, ${stepKindName(step).toLowerCase()}`;
}

/**
 * One line of the "While you were away" summary: "Pour to 150 g at 1:30", "Swirl at 1:45".
 * The caller passes its weight and clock formatters (the user's units).
 */
export function missedStepText(
  step: StepData,
  formatWeight: (grams: number) => string,
  formatClock: (seconds: number) => string,
): string {
  const at = formatClock(step.at_s);
  if (step.kind === 'pour' && step.target_g != null) {
    return `Pour to ${formatWeight(step.target_g)} at ${at}`;
  }
  return `${stepKindName(step)} at ${at}`;
}
