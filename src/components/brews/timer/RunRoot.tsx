'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { applyQuickChange } from '@/lib/brews/quick-change';
import { playCueSound, unlockAudio, vibrateCue } from '@/lib/brews/audio';
import { stepAnnouncement } from '@/lib/brews/describe';
import { logTimerEvent } from '@/lib/brews/events';
import { brewLogPath } from '@/lib/brews/paths';
import type { BrewSession, SessionVersion } from '@/lib/brews/schema';
import { withTimer } from '@/lib/brews/sessions';
import {
  endsWithDrawdown,
  stepPosition,
  type TimerMode,
  type TimerPhase,
  type TimerState,
} from '@/lib/brews/timer';
import {
  useAudioStatus,
  useCanVibrate,
  useTimerPrefs,
  useWakeLock,
  type WakeLockStatus,
} from '@/lib/brews/useDeviceFeatures';
import { useTimerEngine } from '@/lib/brews/useTimerEngine';
import type { AudioStatus } from '@/lib/brews/audio';
import type { TimerPrefs } from '@/lib/brews/prefs';
import type { StepData } from '@/lib/recipes/steps';
import { useUnits } from '@/lib/settings/useSettings';
import { GuidedView } from './GuidedView';
import { SteepView } from './SteepView';
import { EndBrewDialog, MissedCuesDialog } from './TimerDialogs';

/** Everything a timer view needs: the numbers to show and the actions the buttons call. */
export type RunControl = {
  session: BrewSession;
  /** The version as it will be brewed (quick change applied). */
  applied: SessionVersion;
  steps: StepData[];
  state: TimerState;
  phase: TimerPhase;
  mode: TimerMode;
  /** Seconds since t = 0; negative during the count-in. */
  elapsed: number;
  now: number;
  announcement: string;
  wake: WakeLockStatus;
  prefs: TimerPrefs;
  setPrefs: (patch: Partial<TimerPrefs>) => void;
  canVibrate: boolean;
  audioStatus: AudioStatus;
  enableSound: () => void;
  togglePause: () => void;
  skipCountin: () => void;
  finish: () => void;
  openEnd: () => void;
  goHome: () => void;
};

type Props = Readonly<{
  session: BrewSession;
  update: (change: (s: BrewSession) => BrewSession) => BrewSession | null;
  leave: (path: string, options?: { discard?: boolean }) => void;
}>;

/**
 * The running timer (guided, stopwatch or steep): connects the saved timer state to the clock,
 * plays the cues, keeps the screen awake, and hands the numbers to the view. Mounted when the
 * brew starts, or when a running session is reopened, so a reload resumes with the right time.
 */
export function RunRoot({ session, update, leave }: Props) {
  const router = useRouter();
  const { units } = useUnits();
  // What the brew runs on is fixed from the moment it starts.
  const [initial] = useState<TimerState>(() => session.timer as TimerState);
  const [applied] = useState<SessionVersion>(() => applyQuickChange(session.version, session.quickChange));
  const steps = applied.steps;
  const mode = initial.mode;

  const { prefs, setPrefs } = useTimerPrefs();
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  });
  const canVibrate = useCanVibrate();
  const audioStatus = useAudioStatus();

  const engine = useTimerEngine({
    initial,
    steps,
    onPersist: (state) => void update((s) => withTimer(s, state)),
    onCue: (cue) => {
      if (prefsRef.current.sound) playCueSound(cue.kind);
      if (prefsRef.current.vibration) vibrateCue(cue.kind);
    },
  });
  const { state, elapsed, now, dispatch, missed, clearMissed } = engine;
  const phase = state.phase;
  const running = phase === 'running' || phase === 'finishing';

  const wake = useWakeLock(
    mode !== 'steep' &&
      (phase === 'countin' || phase === 'running' || phase === 'paused' || phase === 'finishing'),
  );

  // Announce each step as it starts (the clock itself is not a live region).
  const currentIndex = running ? stepPosition(steps, elapsed).currentIndex : null;
  const [announced, setAnnounced] = useState<number | null>(null);
  if (currentIndex !== announced && running) setAnnounced(currentIndex);
  const announcement =
    announced == null ? '' : stepAnnouncement(steps, announced, units.weight_unit);

  const [endOpen, setEndOpen] = useState(false);
  const leftRef = useRef(false);

  // When the brew has ended (finished, or logged early), the log opens with everything pre-filled.
  useEffect(() => {
    if (phase === 'done' && !leftRef.current) {
      leftRef.current = true;
      leave(brewLogPath(session.id));
    }
  }, [phase, leave, session.id]);

  const togglePause = () => {
    if (phase === 'running') dispatch({ type: 'PAUSE' });
    else if (phase === 'paused') dispatch({ type: 'RESUME' });
  };

  // Space pauses and resumes, unless it is being used by a button or a field.
  useEffect(() => {
    if (mode === 'steep') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, input, textarea, select, [role="button"], [role="switch"]')) return;
      event.preventDefault();
      if (phase === 'running') dispatch({ type: 'PAUSE' });
      else if (phase === 'paused') dispatch({ type: 'RESUME' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, phase, dispatch]);

  const control: RunControl = {
    session,
    applied,
    steps,
    state,
    phase,
    mode,
    elapsed,
    now,
    announcement,
    wake,
    prefs,
    setPrefs,
    canVibrate,
    audioStatus,
    enableSound: () => void unlockAudio(),
    togglePause,
    skipCountin: () => dispatch({ type: 'SKIP_COUNTIN' }),
    finish: () => {
      dispatch({ type: 'FINISH', withDrawdown: mode === 'guided' && endsWithDrawdown(session.method) });
      logTimerEvent('timer_completed', session);
    },
    openEnd: () => setEndOpen(true),
    goHome: () => router.push('/home'),
  };

  return (
    <>
      {mode === 'steep' ? <SteepView ctl={control} /> : <GuidedView ctl={control} />}
      <MissedCuesDialog cues={missed} steps={steps} onClose={clearMissed} />
      <EndBrewDialog
        isOpen={endOpen}
        onOpenChange={setEndOpen}
        onLogAnyway={() => {
          dispatch({ type: 'LOG_ANYWAY' });
          logTimerEvent('timer_completed', session, { early: true });
        }}
        onDiscard={() => {
          logTimerEvent('timer_abandoned', session);
          leave('/home', { discard: true });
        }}
      />
    </>
  );
}
