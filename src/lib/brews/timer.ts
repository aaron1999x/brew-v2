import { hasPourTemperatures, totalTimeS, type StepData } from '@/lib/recipes/steps';

/**
 * The brew timer as a pure state machine. Every function takes the clock (`now`, epoch ms) as an
 * argument, so the state can be saved in the brew session and the clock is right after the phone
 * locks, the app is switched away from, or iOS reloads the tab. Behaviour is the prototype's
 * (src/pages/Timer.tsx): a 5 s count-in, a warning beep 5 s before each step, a go beep at each
 * step, a soft pip for steps that aren't pours, and the kettle-switch hint on the next pour.
 *
 *   prep → countin → running ⇄ paused
 *                       ↓
 *                   finishing → done          (steep skips the count-in; the stopwatch has no finishing)
 *
 * Time t = 0 is the end of the count-in. During the count-in the elapsed time is negative
 * (−5 … 0), so count-in ticks and step cues share one schedule.
 */

export const COUNTIN_S = 5;
/** A cue this close to "now" is played; an older one was missed while the app was away. */
export const CUE_GRACE_S = 1;
/** Recipes this long or longer use the steep screen (no wake lock, no count-in). */
export const STEEP_MIN_S = 3600;

export type TimerMode = 'guided' | 'steep' | 'stopwatch';
export type TimerPhase = 'prep' | 'countin' | 'running' | 'paused' | 'finishing' | 'done';

export type TimerState = {
  mode: TimerMode;
  phase: TimerPhase;
  /** The last step's end in seconds; null for the stopwatch. */
  endS: number | null;
  /** When Start was tapped (guided and stopwatch). */
  countinStartedAt: number | null;
  /** Wall-clock time of t = 0 (the brewed-at moment). For a steep, when Start steep was tapped. */
  startedAt: number | null;
  pausedAt: number | null;
  pausedTotalMs: number;
  /** Elapsed seconds up to which cues have been processed. */
  seenS: number;
  /** Elapsed seconds frozen when the timer ended. */
  finishedS: number | null;
  /** Drawdown in whole seconds, when the person tapped "Drawdown done". */
  drawdownS: number | null;
  ended: 'finished' | 'log_anyway' | null;
};

export type TimerEvent =
  | { type: 'START'; now: number }
  | { type: 'SKIP_COUNTIN'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'FINISH'; now: number; withDrawdown: boolean }
  | { type: 'LOG_ANYWAY'; now: number };

/** No steps → stopwatch; an hour or more → steep; otherwise the guided timer. */
export function chooseMode(steps: readonly StepData[]): TimerMode {
  const total = totalTimeS(steps);
  if (total == null) return 'stopwatch';
  return total >= STEEP_MIN_S ? 'steep' : 'guided';
}

export function createTimerState(steps: readonly StepData[]): TimerState {
  const mode = chooseMode(steps);
  return {
    mode,
    phase: 'prep',
    endS: totalTimeS(steps),
    countinStartedAt: null,
    startedAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
    // Start just below the first count-in tick (t = −5) so it is not skipped.
    seenS: mode === 'steep' ? 0 : -(COUNTIN_S + 1),
    finishedS: null,
    drawdownS: null,
    ended: null,
  };
}

/** Seconds since t = 0: negative during the count-in, frozen while paused and after the end. */
export function elapsedS(state: TimerState, now: number): number {
  switch (state.phase) {
    case 'prep':
      return 0;
    case 'countin':
      return (now - (state.countinStartedAt ?? now)) / 1000 - COUNTIN_S;
    case 'paused':
      return ((state.pausedAt ?? now) - (state.startedAt ?? now) - state.pausedTotalMs) / 1000;
    case 'done':
      return state.finishedS ?? 0;
    default:
      return (now - (state.startedAt ?? now) - state.pausedTotalMs) / 1000;
  }
}

/** Seconds left of the count-in (5 → 0), or null outside it. */
export function countinLeftS(state: TimerState, now: number): number | null {
  if (state.phase !== 'countin') return null;
  return Math.max(0, -elapsedS(state, now));
}

/** The moment t = 0 happened (becomes `brewed_at`), or null before the brew started. */
export function brewedAtMs(state: TimerState): number | null {
  return state.startedAt;
}

const isLive = (phase: TimerPhase) => phase === 'running' || phase === 'finishing';

export function reduce(state: TimerState, event: TimerEvent): TimerState {
  switch (event.type) {
    case 'START': {
      if (state.phase !== 'prep') return state;
      if (state.mode === 'steep') {
        return { ...state, phase: 'running', startedAt: event.now, seenS: 0 };
      }
      return { ...state, phase: 'countin', countinStartedAt: event.now };
    }
    case 'SKIP_COUNTIN': {
      if (state.phase !== 'countin') return state;
      // The go beep (t = 0) still plays; the ticks that were left are skipped, as in the prototype.
      return { ...state, phase: 'running', startedAt: event.now, seenS: -0.001 };
    }
    case 'TICK': {
      let next = state;
      if (next.phase === 'countin' && event.now >= (next.countinStartedAt ?? event.now) + COUNTIN_S * 1000) {
        next = {
          ...next,
          phase: 'running',
          startedAt: (next.countinStartedAt ?? event.now) + COUNTIN_S * 1000,
        };
      }
      if (next.phase === 'running' && next.endS != null && elapsedS(next, event.now) >= next.endS) {
        next = { ...next, phase: 'finishing' };
      }
      return next;
    }
    case 'PAUSE': {
      // Only while running: the drawdown clock after the last step keeps going.
      if (state.phase !== 'running') return state;
      return { ...state, phase: 'paused', pausedAt: event.now };
    }
    case 'RESUME': {
      if (state.phase !== 'paused') return state;
      return {
        ...state,
        phase: 'running',
        pausedAt: null,
        pausedTotalMs: state.pausedTotalMs + (event.now - (state.pausedAt ?? event.now)),
      };
    }
    case 'FINISH': {
      if (state.phase !== 'running' && state.phase !== 'paused' && state.phase !== 'finishing') return state;
      const finished = Math.max(0, elapsedS(state, event.now));
      return {
        ...state,
        phase: 'done',
        finishedS: finished,
        drawdownS: event.withDrawdown ? Math.round(finished) : null,
        ended: 'finished',
      };
    }
    case 'LOG_ANYWAY': {
      if (state.phase === 'prep' || state.phase === 'done') return state;
      if (state.phase === 'countin') {
        return { ...state, phase: 'done', startedAt: event.now, finishedS: 0, ended: 'log_anyway' };
      }
      return {
        ...state,
        phase: 'done',
        finishedS: Math.max(0, elapsedS(state, event.now)),
        drawdownS: null,
        ended: 'log_anyway',
      };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Cues
// ---------------------------------------------------------------------------------------------

/**
 * tick: count-in (880 Hz) · go: brew start and a pour (two 990 Hz beeps) · warn: 5 s before a pour
 * (660 Hz) · soft-go / soft-warn: the same for steps that aren't pours (a quiet 1480 Hz pip).
 */
export type CueKind = 'tick' | 'go' | 'warn' | 'soft-warn' | 'soft-go';

export type Cue = {
  id: string;
  /** Seconds since t = 0 (negative in the count-in). */
  t: number;
  kind: CueKind;
  /** The step this cue belongs to; null for the count-in and the start. */
  stepIndex: number | null;
};

/**
 * Every cue of a brew, in time order. The count-in ticks at −5 … −1 and the start beep at 0 (not
 * for a steep). Each step after 0:00 gets a warning 5 s before it (skipped when it would fall on
 * the start beep) and a beep at its time. Steps at 0:00 get none of their own: the start beep covers them.
 */
export function cueSchedule(steps: readonly StepData[], mode: TimerMode): Cue[] {
  const cues: Cue[] = [];
  if (mode !== 'steep') {
    for (let k = COUNTIN_S; k >= 1; k--) {
      cues.push({ id: `tick:${k}`, t: -k, kind: 'tick', stepIndex: null });
    }
    cues.push({ id: 'go:0', t: 0, kind: 'go', stepIndex: null });
  }
  steps.forEach((step, stepIndex) => {
    if (step.at_s <= 0) return;
    const pour = step.kind === 'pour';
    if (step.at_s > COUNTIN_S) {
      cues.push({
        id: `w:${step.id}`,
        t: step.at_s - COUNTIN_S,
        kind: pour ? 'warn' : 'soft-warn',
        stepIndex,
      });
    }
    cues.push({ id: `g:${step.id}`, t: step.at_s, kind: pour ? 'go' : 'soft-go', stepIndex });
  });
  return cues
    .map((cue, order) => ({ cue, order }))
    .sort((a, b) => a.cue.t - b.cue.t || a.order - b.order)
    .map((x) => x.cue);
}

export type AdvanceResult = {
  state: TimerState;
  elapsedS: number;
  /** Cues to play now. */
  live: Cue[];
  /** Step starts that passed while the app was away: for the "While you were away" summary. */
  missed: Cue[];
};

/**
 * Brings the timer up to `now`: ends the count-in, moves to finishing after the last step, and sorts
 * the cues that came due since the last call into those to play (within a second of now) and those
 * that were missed. Call it on every frame and when the page becomes visible again.
 */
export function advance(state: TimerState, now: number, schedule: readonly Cue[]): AdvanceResult {
  let next = reduce(state, { type: 'TICK', now });
  const e = elapsedS(next, now);
  if (!isLive(next.phase) && next.phase !== 'countin') {
    return { state: next, elapsedS: e, live: [], missed: [] };
  }
  const due = schedule.filter((c) => c.t > next.seenS && c.t <= e);
  const live = due.filter((c) => c.t > e - CUE_GRACE_S);
  const missed = due.filter(
    (c) => c.t <= e - CUE_GRACE_S && c.stepIndex != null && (c.kind === 'go' || c.kind === 'soft-go'),
  );
  if (e > next.seenS) next = { ...next, seenS: e };
  return { state: next, elapsedS: e, live, missed };
}

// ---------------------------------------------------------------------------------------------
// What to show
// ---------------------------------------------------------------------------------------------

export type StepPosition = {
  /** The last step that has started (null before the first). */
  currentIndex: number | null;
  /** The first step that hasn't started yet (null after the last). */
  nextIndex: number | null;
  secondsToNext: number | null;
};

/** The current and next step at an elapsed time. During the count-in the first step is "next". */
export function stepPosition(steps: readonly StepData[], elapsed: number): StepPosition {
  let currentIndex: number | null = null;
  let nextIndex: number | null = null;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i]!.at_s <= elapsed) currentIndex = i;
    else if (nextIndex == null) nextIndex = i;
  }
  return {
    currentIndex,
    nextIndex,
    secondsToNext: nextIndex == null ? null : steps[nextIndex]!.at_s - elapsed,
  };
}

const sameTemp = (a: number, b: number) => Math.abs(a - b) < 0.05;

/**
 * The temperature to switch the kettle to, when the next step is a pour at a different
 * temperature from the pour before it (or from the recipe's, for the first). Null otherwise,
 * and always null when the recipe has no per-pour temperatures. Shown for as long as that pour is next.
 */
export function nextTempCue(
  steps: readonly StepData[],
  elapsed: number,
  baseTempC: number | null,
): number | null {
  if (!hasPourTemperatures(steps)) return null;
  const { nextIndex } = stepPosition(steps, elapsed);
  if (nextIndex == null) return null;
  const next = steps[nextIndex]!;
  if (next.kind !== 'pour') return null;
  const tempOf = (s: StepData): number | null => s.temp_c ?? baseTempC;
  const target = tempOf(next);
  if (target == null) return null;
  let previous: number | null = baseTempC;
  for (const s of steps) {
    if (s.kind === 'pour' && s.at_s < next.at_s) previous = tempOf(s);
  }
  return previous != null && sameTemp(previous, target) ? null : target;
}

/** Pour-over and hybrid brews end with "Drawdown done"; every other method with "Done". */
export function endsWithDrawdown(method: string): boolean {
  return method === 'pour_over' || method === 'hybrid';
}

// ---------------------------------------------------------------------------------------------
// Steep
// ---------------------------------------------------------------------------------------------

/** When the steep ends (epoch ms), or null before Start steep. */
export function steepEndsAt(state: TimerState): number | null {
  if (state.startedAt == null || state.endS == null) return null;
  return state.startedAt + state.endS * 1000;
}

/** Seconds left of the steep, never below 0. */
export function steepRemainingS(state: TimerState, now: number): number {
  if (state.endS == null) return 0;
  return Math.max(0, state.endS - elapsedS(state, now));
}

/** The clock time (epoch ms) of every step, for "Open valve at 8:15 pm". */
export function steepStepTimes(
  state: TimerState,
  steps: readonly StepData[],
): { index: number; atMs: number }[] {
  if (state.startedAt == null) return [];
  const startedAt = state.startedAt;
  return steps.map((s, index) => ({ index, atMs: startedAt + s.at_s * 1000 }));
}
