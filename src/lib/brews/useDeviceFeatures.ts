'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { canVibrate, getAudioStatus, subscribeAudio, type AudioStatus } from './audio';
import { PREFS_KEY, parsePrefs, writePrefs, type TimerPrefs } from './prefs';

const PREFS_CHANGED = 'brew-timer-prefs:changed';

function subscribePrefs(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(PREFS_CHANGED, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(PREFS_CHANGED, onChange);
  };
}

function readRawPrefs(): string {
  try {
    return window.localStorage.getItem(PREFS_KEY) ?? '';
  } catch {
    return '';
  }
}

/** The Sound and Vibration switches, remembered on this device. */
export function useTimerPrefs(): { prefs: TimerPrefs; setPrefs: (patch: Partial<TimerPrefs>) => void } {
  const raw = useSyncExternalStore(subscribePrefs, readRawPrefs, () => '');
  const prefs = useMemo(() => parsePrefs(raw), [raw]);

  const setPrefs = useCallback(
    (patch: Partial<TimerPrefs>) => {
      writePrefs({ ...prefs, ...patch });
      window.dispatchEvent(new Event(PREFS_CHANGED));
    },
    [prefs],
  );

  return { prefs, setPrefs };
}

const noSubscription = () => () => undefined;

/** True where the browser can vibrate (not iPhone). False on the server. */
export function useCanVibrate(): boolean {
  return useSyncExternalStore(noSubscription, canVibrate, () => false);
}

export function useAudioStatus(): AudioStatus {
  return useSyncExternalStore(subscribeAudio, getAudioStatus, () => 'idle');
}

export type WakeLockStatus = 'idle' | 'held' | 'unsupported' | 'refused';

const wakeLockSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;

/**
 * Keeps the screen on while `active`: requests the lock, asks for it again when the page becomes
 * visible (the browser drops it whenever the page is hidden) and lets go when `active` ends or the
 * screen unmounts. If the browser can't or won't, the status says so and the brew carries on.
 */
export function useWakeLock(active: boolean): WakeLockStatus {
  const supported = useSyncExternalStore(noSubscription, wakeLockSupported, () => true);
  const [outcome, setOutcome] = useState<'held' | 'refused' | null>(null);

  useEffect(() => {
    if (!active || !wakeLockSupported()) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || sentinel) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void lock.release().catch(() => undefined);
          return;
        }
        sentinel = lock;
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null;
        });
        setOutcome('held');
      } catch {
        // Low battery, a setting or an iOS version without support: carry on without it.
        if (!cancelled) setOutcome('refused');
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
      setOutcome(null);
    };
  }, [active]);

  if (!active) return 'idle';
  if (!supported) return 'unsupported';
  return outcome ?? 'idle';
}
