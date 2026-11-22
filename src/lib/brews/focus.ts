import { hasPourTemperatures, pourDeltas, type StepData } from '@/lib/recipes/steps';
import { stepKindName } from './describe';
import { nextTempCue, stepPosition } from './timer';

/** The user's formatters, so this stays pure (and the words come out in their units). */
export type FocusFormat = {
  weight: (grams: number) => string;
  temp: (celsius: number) => string;
  /** Lengths of time: "0:15", "1:05". */
  duration: (seconds: number) => string;
  /** When a step happens: "0:40" on the brew clock, or "8:15 pm" on the wall clock (a steep). */
  at: (stepSeconds: number) => string;
};

export type FocusInfo = {
  /** What is happening now, in plain words: "On scale 40 g · kettle 65 °C". Null before the first step. */
  status: string | null;
  /** The step after this one: "Next pour at 0:40 · Centre spiral" or "Next: Swirl at 1:45". */
  nextLine: string | null;
  /** The big thing: the next target weight, or the name of the next step. */
  hero: { kind: 'weight'; grams: number } | { kind: 'name'; text: string; detail: string | null } | null;
  /** "+60 g this pour". */
  delta: string | null;
  /** "Switch kettle → 92 °C" (a change) or plain "92 °C" (the pour is at the temperature you're at). */
  kettle: { text: string; change: boolean } | null;
  /** "in 39 s". */
  countdown: string | null;
  /** Seconds until the next step is due (for emphasis in the last 5 s). */
  secondsToNext: number | null;
  /** After the last step: what to say instead. */
  done: { title: string } | null;
};

/** The scale weight after the last pour that has started by step `index`. */
export function scaleWeightAt(steps: readonly StepData[], index: number): number | null {
  for (let i = index; i >= 0; i--) {
    const s = steps[i]!;
    if (s.kind === 'pour' && s.target_g != null) return s.target_g;
  }
  return null;
}

/** "in 39 s", or "in 1:05" from a minute up. */
export function countdownText(seconds: number, duration: (s: number) => string): string {
  const s = Math.max(0, Math.ceil(seconds));
  return s >= 60 ? `in ${duration(s)}` : `in ${s} s`;
}

/**
 * Everything the one focus card on the timer says, from the steps and the clock. Follows the
 * prototype's card (src/pages/Timer.tsx): where the scale is and the kettle temperature, the next
 * step, the next weight as the hero number, the "switch kettle" chip and the countdown; the status
 * wording for waits and the "+60 g this pour" line are ours.
 */
export function focusInfo(
  steps: readonly StepData[],
  elapsed: number,
  baseTempC: number | null,
  fmt: FocusFormat,
): FocusInfo {
  const position = stepPosition(steps, elapsed);
  const varies = hasPourTemperatures(steps);
  const deltas = pourDeltas(steps);
  const current = position.currentIndex == null ? null : steps[position.currentIndex]!;
  const next = position.nextIndex == null ? null : steps[position.nextIndex]!;

  let status: string | null = null;
  if (current && position.currentIndex != null) {
    if (current.kind === 'pour' && current.target_g != null) {
      const temp = current.temp_c ?? baseTempC;
      status =
        `On scale ${fmt.weight(current.target_g)}` +
        (varies && temp != null ? ` · kettle ${fmt.temp(temp)}` : '');
    } else {
      const scale = scaleWeightAt(steps, position.currentIndex);
      const left = current.duration_s ? current.at_s + current.duration_s - elapsed : null;
      status =
        stepKindName(current) +
        (scale != null ? ` · scale stays at ${fmt.weight(scale)}` : '') +
        (left != null && left > 0 ? ` · ${fmt.duration(Math.ceil(left))} left` : '');
    }
  }

  if (!next) {
    const last = steps.at(-1);
    return {
      status,
      nextLine: null,
      hero: null,
      delta: null,
      kettle: null,
      countdown: null,
      secondsToNext: null,
      done: { title: last?.kind === 'pour' ? 'Last pour done' : 'All steps done' },
    };
  }

  const isPour = next.kind === 'pour' && next.target_g != null;
  const nextLine = isPour
    ? `Next pour at ${fmt.at(next.at_s)}${next.technique ? ` · ${next.technique}` : ''}`
    : `Next: ${stepKindName(next)} at ${fmt.at(next.at_s)}${next.technique ? ` · ${next.technique}` : ''}`;

  const switchTo = nextTempCue(steps, elapsed, baseTempC);
  const nextTemp = next.temp_c ?? baseTempC;
  const kettle =
    isPour && varies
      ? switchTo != null
        ? { text: `Switch kettle → ${fmt.temp(switchTo)}`, change: true }
        : nextTemp != null
          ? { text: fmt.temp(nextTemp), change: false }
          : null
      : null;

  const delta = isPour ? deltas.get(next.id) : undefined;
  return {
    status,
    nextLine,
    hero: isPour
      ? { kind: 'weight', grams: next.target_g as number }
      : {
          kind: 'name',
          text: stepKindName(next),
          detail: next.duration_s ? fmt.duration(next.duration_s) : null,
        },
    delta: delta == null ? null : `+${fmt.weight(delta)} this pour`,
    kettle,
    countdown: countdownText(position.secondsToNext ?? 0, fmt.duration),
    secondsToNext: position.secondsToNext,
    done: null,
  };
}
