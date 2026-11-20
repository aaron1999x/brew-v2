import type { StorageLike } from './sessions';

/** Timer switches remembered on this device (not on the account). */
export type TimerPrefs = { sound: boolean; vibration: boolean };

export const PREFS_KEY = 'brew-timer-prefs:v1';
export const DEFAULT_PREFS: TimerPrefs = { sound: true, vibration: true };

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The switches in a stored value; anything missing or unreadable falls back to on. */
export function parsePrefs(raw: string | null | undefined): TimerPrefs {
  try {
    if (!raw) return DEFAULT_PREFS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFS;
    const p = parsed as Partial<Record<keyof TimerPrefs, unknown>>;
    return {
      sound: typeof p.sound === 'boolean' ? p.sound : DEFAULT_PREFS.sound,
      vibration: typeof p.vibration === 'boolean' ? p.vibration : DEFAULT_PREFS.vibration,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** The saved switches. */
export function readPrefs(storage: StorageLike | null = defaultStorage()): TimerPrefs {
  try {
    return parsePrefs(storage?.getItem(PREFS_KEY));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(prefs: TimerPrefs, storage: StorageLike | null = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PREFS_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}
