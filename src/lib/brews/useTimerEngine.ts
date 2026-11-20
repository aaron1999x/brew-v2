'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StepData } from '@/lib/recipes/steps';
import {
  advance,
  cueSchedule,
  elapsedS,
  reduce,
  type Cue,
  type TimerEvent,
  type TimerState,
} from './timer';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type TimerCommand = DistributiveOmit<TimerEvent, 'now'>;

type Options = {
  /** The saved timer state; read once, when the screen opens. */
  initial: TimerState;
  steps: StepData[];
  /** Called when the state is worth saving (an event, a phase change, a cue played). */
  onPersist: (state: TimerState) => void;
  /** Called for each cue to play now. */
  onCue: (cue: Cue) => void;
};

/**
 * Runs the pure timer in `lib/brews/timer.ts` against the real clock. The wall-clock start lives
 * in the state (and the saved session), so the time is right after the phone locks, the app is
 * switched away from, or iOS reloads the tab: on every frame and whenever the page becomes visible
 * again the timer is brought up to `Date.now()`, and cues that passed while away come back as `missed`.
 */
export function useTimerEngine({ initial, steps, onPersist, onCue }: Options) {
  const schedule = useMemo(() => cueSchedule(steps, initial.mode), [steps, initial.mode]);
  const stateRef = useRef(initial);
  const [state, setState] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [missed, setMissed] = useState<Cue[]>([]);
  const lastPaint = useRef(0);

  const persistRef = useRef(onPersist);
  const cueRef = useRef(onCue);
  useEffect(() => {
    persistRef.current = onPersist;
    cueRef.current = onCue;
  });

  const tick = useCallback(() => {
    const t = Date.now();
    const before = stateRef.current;
    const result = advance(before, t, schedule);
    stateRef.current = result.state;
    for (const cue of result.live) cueRef.current(cue);
    if (result.missed.length > 0) setMissed((list) => [...list, ...result.missed]);
    const phaseChanged = result.state.phase !== before.phase;
    if (phaseChanged) setState(result.state);
    if (phaseChanged || result.live.length > 0 || result.missed.length > 0) {
      persistRef.current(result.state);
    }
    // Repaint ten times a second, not on every frame: the digits only show whole seconds.
    if (phaseChanged || t - lastPaint.current >= 100) {
      lastPaint.current = t;
      setNow(t);
    }
  }, [schedule]);

  const dispatch = useCallback((command: TimerCommand) => {
    const t = Date.now();
    const next = reduce(stateRef.current, { ...command, now: t } as TimerEvent);
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
    setNow(t);
    persistRef.current(next);
  }, []);

  const mode = initial.mode;
  const live = state.phase === 'countin' || state.phase === 'running' || state.phase === 'finishing';

  useEffect(() => {
    tick();
    if (!live) return;
    // Wake up every 100 ms (250 ms for a steep), and exactly when the next cue is due, so beeps
    // are on time without a 60-frames-a-second loop draining the battery: the digits only show
    // whole seconds, and the clock itself never depends on how often this runs.
    const idleMs = mode === 'steep' ? 250 : 100;
    let timer = 0;
    const loop = () => {
      tick();
      const current = stateRef.current;
      const next = schedule.find((c) => c.t > current.seenS);
      const untilCueMs = next ? (next.t - elapsedS(current, Date.now())) * 1000 : idleMs;
      timer = window.setTimeout(loop, Math.max(0, Math.min(idleMs, untilCueMs)));
    };
    timer = window.setTimeout(loop, idleMs);
    return () => window.clearTimeout(timer);
  }, [live, mode, tick, schedule]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
      else persistRef.current(stateRef.current);
    };
    const onHide = () => persistRef.current(stateRef.current);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
    };
  }, [tick]);

  return {
    state,
    now,
    elapsed: elapsedS(state, now),
    dispatch,
    missed,
    clearMissed: useCallback(() => setMissed([]), []),
  };
}
