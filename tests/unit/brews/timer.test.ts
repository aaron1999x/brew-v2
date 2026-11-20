import { describe, expect, it } from 'vitest';
import {
  COUNTIN_S,
  advance,
  brewedAtMs,
  chooseMode,
  countinLeftS,
  createTimerState,
  cueSchedule,
  elapsedS,
  endsWithDrawdown,
  nextTempCue,
  reduce,
  steepEndsAt,
  steepRemainingS,
  steepStepTimes,
  stepPosition,
  type Cue,
  type TimerState,
} from '@/lib/brews/timer';
import { timerStateSchema } from '@/lib/brews/schema';
import type { StepData } from '@/lib/recipes/steps';
import { V60_STEPS, methodSteps } from './fixtures';

const T0 = 1_700_000_000_000;

/** Runs the clock from `from` to `to` ms in steps, returning the final state and every cue played. */
function run(
  start: TimerState,
  from: number,
  to: number,
  stepMs: number,
  schedule: readonly Cue[],
) {
  let state = start;
  const played: { id: string; kind: string; at: number }[] = [];
  const missed: string[] = [];
  for (let now = from; now <= to; now += stepMs) {
    const r = advance(state, now, schedule);
    state = r.state;
    for (const c of r.live) played.push({ id: c.id, kind: c.kind, at: r.elapsedS });
    for (const c of r.missed) missed.push(c.id);
  }
  return { state, played, missed };
}

/** A guided V60 that has been running for `seconds` (advanced once a second). */
function runningV60(seconds: number) {
  const schedule = cueSchedule(V60_STEPS, 'guided');
  let state = reduce(createTimerState(V60_STEPS), { type: 'START', now: T0 });
  state = run(state, T0, T0 + 5000, 1000, schedule).state;
  state = run(state, T0 + 5000, T0 + 5000 + seconds * 1000, 1000, schedule).state;
  return { state, schedule, startMs: T0 + 5000 };
}

describe('chooseMode', () => {
  it('uses the stopwatch without steps', () => {
    expect(chooseMode([])).toBe('stopwatch');
  });

  it('uses the guided timer under an hour and the steep at an hour or more', () => {
    const wait = (duration_s: number): StepData[] => [{ id: 'w', kind: 'wait', at_s: 0, duration_s }];
    expect(chooseMode(wait(3599))).toBe('guided');
    expect(chooseMode(wait(3600))).toBe('steep');
    expect(chooseMode(wait(3601))).toBe('steep');
  });

  it('picks the right mode for every M3 method fixture', () => {
    expect(chooseMode(methodSteps('v60'))).toBe('guided');
    expect(chooseMode(methodSteps('switch'))).toBe('guided');
    expect(chooseMode(methodSteps('aeropress'))).toBe('guided');
    expect(chooseMode(methodSteps('french_press'))).toBe('guided');
    expect(chooseMode(methodSteps('cold_brew'))).toBe('steep');
    expect(chooseMode(V60_STEPS)).toBe('guided');
  });
});

describe('cueSchedule', () => {
  it('has the count-in ticks, the start beep and a warning and beep per step', () => {
    const schedule = cueSchedule(V60_STEPS, 'guided');
    expect(schedule.map((c) => `${c.id}@${c.t}`)).toEqual([
      'tick:5@-5',
      'tick:4@-4',
      'tick:3@-3',
      'tick:2@-2',
      'tick:1@-1',
      'go:0@0',
      'w:s2@5',
      'g:s2@10',
      'w:s3@40',
      'g:s3@45',
      'w:s4@70',
      'g:s4@75',
      'w:s5@95',
      'g:s5@100',
      'w:s6@105',
      'g:s6@110',
    ]);
  });

  it('beeps for pours and pips for everything else', () => {
    const kind = (id: string) => cueSchedule(V60_STEPS, 'guided').find((c) => c.id === id)?.kind;
    expect(kind('w:s3')).toBe('warn');
    expect(kind('g:s3')).toBe('go');
    expect(kind('w:s2')).toBe('soft-warn');
    expect(kind('g:s2')).toBe('soft-go');
    expect(kind('tick:3')).toBe('tick');
    expect(kind('go:0')).toBe('go');
  });

  it('gives steps at 0:00 no cue of their own and skips a warning that would land on the start', () => {
    const steps: StepData[] = [
      { id: 'a', kind: 'other', at_s: 0, label: 'Close valve' },
      { id: 'b', kind: 'pour', at_s: 0, target_g: 240 },
      { id: 'c', kind: 'pour', at_s: 4, target_g: 300 },
      { id: 'd', kind: 'pour', at_s: 6, target_g: 350 },
    ];
    const ids = cueSchedule(steps, 'guided').map((c) => c.id);
    expect(ids).not.toContain('g:a');
    expect(ids).not.toContain('g:b');
    expect(ids).not.toContain('w:c');
    expect(ids).toContain('g:c');
    expect(ids).toContain('w:d');
  });

  it('has no count-in for a steep and no step cues for the stopwatch', () => {
    const steep = cueSchedule(methodSteps('cold_brew'), 'steep');
    expect(steep.some((c) => c.kind === 'tick' || c.id === 'go:0')).toBe(false);
    expect(steep.map((c) => c.id)).toContain('g:cb-2');
    expect(cueSchedule([], 'stopwatch').map((c) => c.id)).toEqual([
      'tick:5',
      'tick:4',
      'tick:3',
      'tick:2',
      'tick:1',
      'go:0',
    ]);
  });

  it('is in time order', () => {
    for (const key of ['v60', 'switch', 'aeropress', 'french_press', 'cold_brew']) {
      const steps = methodSteps(key);
      const times = cueSchedule(steps, chooseMode(steps)).map((c) => c.t);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
  });
});

describe('the guided timer', () => {
  it('starts in prep with a clock at zero', () => {
    const state = createTimerState(V60_STEPS);
    expect(state.phase).toBe('prep');
    expect(state.mode).toBe('guided');
    expect(state.endS).toBe(110);
    expect(elapsedS(state, T0 + 99_999)).toBe(0);
    expect(brewedAtMs(state)).toBeNull();
  });

  it('counts in for five seconds with the ticks and the start beep, then runs from 0', () => {
    const schedule = cueSchedule(V60_STEPS, 'guided');
    let state = reduce(createTimerState(V60_STEPS), { type: 'START', now: T0 });
    expect(state.phase).toBe('countin');
    expect(elapsedS(state, T0)).toBe(-5);
    expect(countinLeftS(state, T0 + 2000)).toBe(3);

    const r = run(state, T0, T0 + 5000, 250, schedule);
    expect(r.played.map((p) => p.id)).toEqual(['tick:5', 'tick:4', 'tick:3', 'tick:2', 'tick:1', 'go:0']);
    expect(r.played.map((p) => p.at)).toEqual([-5, -4, -3, -2, -1, 0]);
    state = r.state;
    expect(state.phase).toBe('running');
    expect(state.startedAt).toBe(T0 + COUNTIN_S * 1000);
    expect(brewedAtMs(state)).toBe(T0 + 5000);
    expect(countinLeftS(state, T0 + 5000)).toBeNull();
  });

  it('plays every cue once, at its time', () => {
    const schedule = cueSchedule(V60_STEPS, 'guided');
    const started = reduce(createTimerState(V60_STEPS), { type: 'START', now: T0 });
    const r = run(started, T0, T0 + 5000 + 115_000, 100, schedule);
    expect(r.played.map((p) => p.id)).toEqual(schedule.map((c) => c.id));
    for (const p of r.played) {
      const due = schedule.find((c) => c.id === p.id)!;
      expect(p.at).toBeGreaterThanOrEqual(due.t);
      expect(p.at - due.t).toBeLessThan(0.11);
      expect(p.kind).toBe(due.kind);
    }
    expect(r.missed).toEqual([]);
  });

  it('skips the rest of the count-in but still plays the start beep', () => {
    const schedule = cueSchedule(V60_STEPS, 'guided');
    let state = reduce(createTimerState(V60_STEPS), { type: 'START', now: T0 });
    state = advance(state, T0 + 2000, schedule).state; // tick:5 … tick:3 already played
    state = reduce(state, { type: 'SKIP_COUNTIN', now: T0 + 2500 });
    expect(state.phase).toBe('running');
    expect(state.startedAt).toBe(T0 + 2500);
    const r = advance(state, T0 + 2500, schedule);
    expect(r.live.map((c) => c.id)).toEqual(['go:0']);
  });

  it('keeps the right time after a pause', () => {
    const { state: running, schedule, startMs } = runningV60(10);
    const paused = reduce(running, { type: 'PAUSE', now: startMs + 10_000 });
    expect(paused.phase).toBe('paused');
    const whilePaused = advance(paused, startMs + 40_000, schedule);
    expect(whilePaused.elapsedS).toBe(10);
    expect(whilePaused.live).toEqual([]);
    expect(whilePaused.missed).toEqual([]);

    const resumed = reduce(paused, { type: 'RESUME', now: startMs + 40_000 });
    expect(resumed.phase).toBe('running');
    expect(resumed.pausedTotalMs).toBe(30_000);
    expect(elapsedS(resumed, startMs + 45_000)).toBe(15);
  });

  it('ignores pause when not running and resume when not paused', () => {
    const prep = createTimerState(V60_STEPS);
    expect(reduce(prep, { type: 'PAUSE', now: T0 })).toBe(prep);
    expect(reduce(prep, { type: 'RESUME', now: T0 })).toBe(prep);
    const { state } = runningV60(5);
    expect(reduce(state, { type: 'RESUME', now: T0 })).toBe(state);
  });

  it('moves to finishing after the last step and keeps the clock running', () => {
    const { state } = runningV60(108);
    expect(state.phase).toBe('running');
    const r = advance(state, T0 + 5000 + 125_000, cueSchedule(V60_STEPS, 'guided'));
    expect(r.state.phase).toBe('finishing');
    expect(r.elapsedS).toBe(125);
    // The drawdown clock can't be paused.
    expect(reduce(r.state, { type: 'PAUSE', now: T0 + 200_000 }).phase).toBe('finishing');
  });

  it('records the drawdown at the tap', () => {
    const { state } = runningV60(110);
    const finishing = advance(state, T0 + 5000 + 110_000, cueSchedule(V60_STEPS, 'guided')).state;
    expect(finishing.phase).toBe('finishing');
    const done = reduce(finishing, { type: 'FINISH', now: T0 + 5000 + 167_400, withDrawdown: true });
    expect(done.phase).toBe('done');
    expect(done.ended).toBe('finished');
    expect(done.finishedS).toBe(167.4);
    expect(done.drawdownS).toBe(167);
    // The clock stays frozen however late it is read.
    expect(elapsedS(done, T0 + 9_999_999)).toBe(167.4);
  });

  it('records no drawdown for methods that end with Done', () => {
    const { state } = runningV60(110);
    const done = reduce(state, { type: 'FINISH', now: T0 + 5000 + 300_000, withDrawdown: false });
    expect(done.phase).toBe('done');
    expect(done.drawdownS).toBeNull();
  });

  it('ends early with the log anyway option and no drawdown', () => {
    const { state, startMs } = runningV60(50);
    const done = reduce(state, { type: 'LOG_ANYWAY', now: startMs + 50_600 });
    expect(done.phase).toBe('done');
    expect(done.ended).toBe('log_anyway');
    expect(done.drawdownS).toBeNull();
    expect(done.finishedS).toBe(50.6);
  });

  it('can be ended during the count-in, dated at that moment', () => {
    const state = reduce(createTimerState(V60_STEPS), { type: 'START', now: T0 });
    const done = reduce(state, { type: 'LOG_ANYWAY', now: T0 + 2000 });
    expect(done.phase).toBe('done');
    expect(done.startedAt).toBe(T0 + 2000);
    expect(done.finishedS).toBe(0);
    expect(reduce(createTimerState(V60_STEPS), { type: 'LOG_ANYWAY', now: T0 }).phase).toBe('prep');
  });

  it('survives being saved and reloaded', () => {
    const { state, startMs } = runningV60(47);
    const restored = timerStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(restored).toEqual(state);
    expect(elapsedS(restored, startMs + 62_000)).toBe(elapsedS(state, startMs + 62_000));
  });
});

describe('cues missed while the app was away', () => {
  it('lists the step starts that passed during a 30 s jump', () => {
    const { state, schedule, startMs } = runningV60(36);
    const r = advance(state, startMs + 66_000, schedule);
    expect(r.elapsedS).toBe(66);
    expect(r.missed.map((c) => c.id)).toEqual(['g:s3']); // the warning at 40 s is not listed
    expect(r.live).toEqual([]);
    expect(r.state.seenS).toBe(66);
  });

  it('lists every step start after a 5 minute jump and moves to finishing', () => {
    const { state, schedule, startMs } = runningV60(20);
    const r = advance(state, startMs + 320_000, schedule);
    expect(r.missed.map((c) => c.id)).toEqual(['g:s3', 'g:s4', 'g:s5', 'g:s6']);
    expect(r.live).toEqual([]);
    expect(r.state.phase).toBe('finishing');
    // Nothing is reported twice.
    const again = advance(r.state, startMs + 321_000, schedule);
    expect(again.missed).toEqual([]);
    expect(again.live).toEqual([]);
  });

  it('plays a cue that is within a second of now and does not list it as missed', () => {
    const { state, schedule, startMs } = runningV60(36);
    const r = advance(state, startMs + 45_500, schedule);
    expect(r.live.map((c) => c.id)).toEqual(['g:s3']);
    expect(r.missed).toEqual([]);
  });

  it('reports nothing for a timer that is not running', () => {
    const schedule = cueSchedule(V60_STEPS, 'guided');
    const prep = advance(createTimerState(V60_STEPS), T0 + 99_000, schedule);
    expect(prep.live).toEqual([]);
    expect(prep.missed).toEqual([]);
    const { state, startMs } = runningV60(10);
    const done = reduce(state, { type: 'FINISH', now: startMs + 10_000, withDrawdown: false });
    const after = advance(done, startMs + 200_000, schedule);
    expect(after.live).toEqual([]);
    expect(after.missed).toEqual([]);
  });
});

describe('the stopwatch', () => {
  it('counts in, runs and ends with Done, never moving to finishing', () => {
    const schedule = cueSchedule([], 'stopwatch');
    let state = createTimerState([]);
    expect(state.mode).toBe('stopwatch');
    expect(state.endS).toBeNull();
    state = reduce(state, { type: 'START', now: T0 });
    state = run(state, T0, T0 + 5000 + 600_000, 5000, schedule).state;
    expect(state.phase).toBe('running');
    expect(elapsedS(state, T0 + 5000 + 600_000)).toBe(600);
    state = reduce(state, { type: 'PAUSE', now: T0 + 5000 + 600_000 });
    expect(state.phase).toBe('paused');
    const done = reduce(state, { type: 'FINISH', now: T0 + 5000 + 900_000, withDrawdown: false });
    expect(done.phase).toBe('done');
    expect(done.finishedS).toBe(600);
  });
});

describe('the steep', () => {
  const steps = methodSteps('cold_brew');

  it('starts at once with no count-in and ends at the last step', () => {
    let state = createTimerState(steps);
    expect(state.mode).toBe('steep');
    expect(state.endS).toBe(43_260);
    state = reduce(state, { type: 'START', now: T0 });
    expect(state.phase).toBe('running');
    expect(state.startedAt).toBe(T0);
    expect(elapsedS(state, T0 + 60_000)).toBe(60);
    expect(steepEndsAt(state)).toBe(T0 + 43_260_000);
    expect(steepRemainingS(state, T0 + 3_260_000)).toBe(40_000);
    expect(steepRemainingS(state, T0 + 99_999_999_999)).toBe(0);

    const later = advance(state, T0 + 43_260_000, cueSchedule(steps, 'steep'));
    expect(later.state.phase).toBe('finishing');
  });

  it('beeps for steps while the app is open, with no count-in', () => {
    const schedule = cueSchedule(steps, 'steep');
    let state = reduce(createTimerState(steps), { type: 'START', now: T0 });
    const r = run(state, T0, T0 + 61_000, 1000, schedule);
    expect(r.played.map((p) => p.id)).toEqual(['w:cb-2', 'g:cb-2', 'w:cb-3', 'g:cb-3']);
    state = r.state;
    expect(state.phase).toBe('running');
  });

  it('gives each step its clock time', () => {
    const state = reduce(createTimerState(steps), { type: 'START', now: T0 });
    expect(steepStepTimes(state, steps).map((s) => s.atMs - T0)).toEqual([0, 30_000, 60_000]);
    expect(steepStepTimes(createTimerState(steps), steps)).toEqual([]);
  });
});

describe('stepPosition', () => {
  it('shows the first step as next during the count-in', () => {
    expect(stepPosition(V60_STEPS, -3)).toEqual({ currentIndex: null, nextIndex: 0, secondsToNext: 3 });
  });

  it('follows the clock through the steps', () => {
    expect(stepPosition(V60_STEPS, 0)).toEqual({ currentIndex: 0, nextIndex: 1, secondsToNext: 10 });
    expect(stepPosition(V60_STEPS, 44.5)).toEqual({ currentIndex: 1, nextIndex: 2, secondsToNext: 0.5 });
    expect(stepPosition(V60_STEPS, 45)).toEqual({ currentIndex: 2, nextIndex: 3, secondsToNext: 30 });
    expect(stepPosition(V60_STEPS, 130)).toEqual({ currentIndex: 5, nextIndex: null, secondsToNext: null });
  });

  it('takes the last of several steps at the same time as current', () => {
    const sw = methodSteps('switch'); // Close valve and the pour are both at 0:00
    expect(stepPosition(sw, 0).currentIndex).toBe(1);
  });
});

describe('nextTempCue (the kettle switch)', () => {
  const withTemps = (temps: (number | null)[]): StepData[] =>
    temps.map((temp, i) => ({
      id: `p${i}`,
      kind: 'pour',
      at_s: i * 30,
      target_g: 50 * (i + 1),
      temp_c: temp,
    }));

  it('is null when no pour has its own temperature', () => {
    expect(nextTempCue(methodSteps('v60'), 5, 93)).toBeNull();
  });

  it('shows the new temperature while the next pour is hotter or cooler than the last', () => {
    const steps = withTemps([95, 95, 90, 90]);
    expect(nextTempCue(steps, 35, 95)).toBe(90); // next pour at 60 s: 95 → 90
    expect(nextTempCue(steps, 60, 95)).toBeNull(); // next pour at 90 s: 90 → 90
    expect(nextTempCue(steps, 10, 95)).toBeNull(); // next pour at 30 s: 95 → 95
  });

  it('compares the first pour with the recipe temperature, even during the count-in', () => {
    const steps = withTemps([96, 96]);
    expect(nextTempCue(steps, -3, 93)).toBe(96);
    expect(nextTempCue(steps, -3, 96)).toBeNull();
  });

  it('uses the recipe temperature for a pour with none of its own', () => {
    const steps = withTemps([95, null]);
    expect(nextTempCue(steps, 5, 93)).toBe(93);
  });

  it('only cues for pours', () => {
    const steps: StepData[] = [
      { id: 'a', kind: 'pour', at_s: 0, target_g: 50, temp_c: 95 },
      { id: 'b', kind: 'swirl', at_s: 10, duration_s: 5 },
      { id: 'c', kind: 'pour', at_s: 30, target_g: 100, temp_c: 90 },
    ];
    expect(nextTempCue(steps, 5, 95)).toBeNull(); // next is the swirl
    expect(nextTempCue(steps, 12, 95)).toBe(90);
    expect(nextTempCue(steps, 31, 95)).toBeNull(); // no next step
  });
});

describe('endsWithDrawdown', () => {
  it('is true for pour-over and hybrid only', () => {
    expect(endsWithDrawdown('pour_over')).toBe(true);
    expect(endsWithDrawdown('hybrid')).toBe(true);
    for (const m of ['immersion', 'aeropress', 'french_press', 'siphon', 'cold_brew', 'other']) {
      expect(endsWithDrawdown(m)).toBe(false);
    }
  });
});
