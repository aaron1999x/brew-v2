import type { CueKind } from './timer';

/**
 * Timer sounds, ported from the prototype (src/pages/Timer.tsx): short sine beeps made with Web
 * Audio. iOS only lets an AudioContext start from a tap, so `unlockAudio()` runs on the Start
 * button; after that the timer plays cues itself. If audio can't start (or iOS suspends it after
 * the phone locks), the timer keeps running and the screen offers "Sound is off: tap to turn on".
 */

export type Tone = { freq: number; ms: number; times: number; vol: number };

/** tick: count-in · go: start and pours · warn: before a pour · soft-*: a quiet pip for other steps. */
export const TONES: Record<CueKind, Tone> = {
  tick: { freq: 880, ms: 90, times: 1, vol: 0.4 },
  warn: { freq: 660, ms: 120, times: 1, vol: 0.4 },
  go: { freq: 990, ms: 160, times: 2, vol: 0.4 },
  'soft-warn': { freq: 1480, ms: 55, times: 1, vol: 0.12 },
  'soft-go': { freq: 1480, ms: 70, times: 1, vol: 0.16 },
};

/** Vibration patterns (milliseconds) for each cue; only where `navigator.vibrate` exists (not iPhone). */
export const VIBRATION: Record<CueKind, number | number[]> = {
  'soft-warn': 35,
  'soft-go': 50,
  tick: 60,
  warn: 150,
  go: [200, 80, 200],
};

export type Beep = { startS: number; endS: number; freq: number; vol: number };

/** The beeps of one cue, as offsets from `at` (seconds): repeats are 80 ms apart. */
export function beepsFor(kind: CueKind, at = 0): Beep[] {
  const { freq, ms, times, vol } = TONES[kind];
  return Array.from({ length: times }, (_, i) => {
    const startS = at + i * (ms / 1000 + 0.08);
    return { startS, endS: startS + ms / 1000, freq, vol };
  });
}

export type AudioStatus = 'idle' | 'running' | 'blocked' | 'unavailable';

let context: AudioContext | null = null;
let status: AudioStatus = 'idle';
const listeners = new Set<() => void>();

function setStatus(next: AudioStatus): AudioStatus {
  if (next !== status) {
    status = next;
    listeners.forEach((listener) => listener());
  }
  return status;
}

function syncStatus(): AudioStatus {
  return setStatus(context && context.state === 'running' ? 'running' : 'blocked');
}

export const getAudioStatus = (): AudioStatus => status;

export function subscribeAudio(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * Creates and resumes the AudioContext. Call it from a tap (Start, or "tap to turn on"). Safe to
 * call again; it never throws.
 */
export async function unlockAudio(): Promise<AudioStatus> {
  try {
    const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Ctor) return setStatus('unavailable');
    if (!context || context.state === 'closed') {
      context = new Ctor();
      context.addEventListener('statechange', syncStatus);
    }
    if (context.state !== 'running') await context.resume();
    // A silent one-sample buffer completes the unlock on iOS.
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, 22_050);
    source.connect(context.destination);
    source.start(0);
    return syncStatus();
  } catch {
    return setStatus('unavailable');
  }
}

/** Plays a cue's beeps. False when audio isn't running (the caller shows the "tap to turn on" prompt). */
export function playCueSound(kind: CueKind): boolean {
  const ctx = context;
  if (!ctx || ctx.state === 'closed') return false;
  if (ctx.state !== 'running') {
    // iOS suspends audio when the phone locks; resuming only works after a tap, but trying is free.
    void ctx.resume().then(syncStatus, () => setStatus('blocked'));
    setStatus('blocked');
    return false;
  }
  try {
    for (const beep of beepsFor(kind, ctx.currentTime)) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = beep.freq;
      gain.gain.setValueAtTime(0.0001, beep.startS);
      gain.gain.exponentialRampToValueAtTime(beep.vol, beep.startS + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, beep.endS);
      osc.connect(gain).connect(ctx.destination);
      osc.start(beep.startS);
      osc.stop(beep.endS + 0.02);
    }
    return true;
  } catch {
    return false;
  }
}

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function vibrateCue(kind: CueKind): void {
  try {
    if (canVibrate()) navigator.vibrate(VIBRATION[kind]);
  } catch {
    /* vibration is a bonus */
  }
}
