import type { StepData } from '@/lib/recipes/steps';
import { createTimerState, type TimerState } from './timer';
import {
  brewSessionSchema,
  type BrewLogDraft,
  type BrewMethod,
  type BrewSession,
  type QuickChange,
  type SessionVersion,
} from './schema';

/**
 * Brew sessions live on the device until the log is saved: nothing is written to the database
 * before that, because `brews.overall` is required and you taste minutes after brewing. Several
 * can exist at once (a cold brew steeping while a V60 is brewed). They are removed only on save or
 * discard, never automatically. Stored in localStorage under `brew-sessions:v1:<userId>`; a bad
 * value is ignored rather than thrown.
 */

export const SESSIONS_VERSION = 1;
export const sessionsKey = (userId: string): string => `brew-sessions:v${SESSIONS_VERSION}:${userId}`;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Every valid session of this person, newest first. Unreadable entries are skipped. */
export function readSessions(userId: string, storage: StorageLike | null = defaultStorage()): BrewSession[] {
  if (!storage) return [];
  let raw: string | null;
  try {
    raw = storage.getItem(sessionsKey(userId));
  } catch {
    return [];
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const sessions: BrewSession[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    const result = brewSessionSchema.safeParse(entry);
    // Another person's session under this key is never shown.
    if (!result.success || result.data.userId !== userId || seen.has(result.data.id)) continue;
    seen.add(result.data.id);
    sessions.push(result.data as BrewSession);
  }
  return sessions.sort((a, b) => b.createdAt - a.createdAt);
}

export function getSession(
  userId: string,
  id: string,
  storage: StorageLike | null = defaultStorage(),
): BrewSession | null {
  return readSessions(userId, storage).find((s) => s.id === id) ?? null;
}

function writeAll(userId: string, sessions: BrewSession[], storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(sessionsKey(userId), JSON.stringify(sessions));
    return true;
  } catch {
    return false;
  }
}

/** Adds or replaces a session (by id). False when the device refused to store it. */
export function writeSession(
  userId: string,
  session: BrewSession,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  const others = readSessions(userId, storage).filter((s) => s.id !== session.id);
  return writeAll(userId, [...others, session], storage);
}

/** Changes one session in place; null when it doesn't exist. */
export function updateSession(
  userId: string,
  id: string,
  change: (session: BrewSession) => BrewSession,
  storage: StorageLike | null = defaultStorage(),
): BrewSession | null {
  const all = readSessions(userId, storage);
  const current = all.find((s) => s.id === id);
  if (!current) return null;
  const next = { ...change(current), updatedAt: Date.now() };
  writeAll(userId, all.map((s) => (s.id === id ? next : s)), storage);
  return next;
}

/** Removes a session (after a successful save, or Discard). */
export function removeSession(
  userId: string,
  id: string,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  const all = readSessions(userId, storage);
  return writeAll(userId, all.filter((s) => s.id !== id), storage);
}

/** The version fields a session keeps, copied from a recipe version. */
export function toSessionVersion(
  v: {
    dose_g: number;
    brew_water_g: number;
    bypass_g: number;
    retention_ratio: number | null;
    temp_c: number | null;
    grind_setting: string | null;
    drawdown_min_s: number | null;
    drawdown_max_s: number | null;
    tds_min: number | null;
    tds_max: number | null;
    ey_min: number | null;
    ey_max: number | null;
    steps: StepData[];
  },
  grinderName: string | null,
): SessionVersion {
  return {
    dose_g: v.dose_g,
    brew_water_g: v.brew_water_g,
    bypass_g: v.bypass_g,
    retention_ratio: v.retention_ratio,
    temp_c: v.temp_c,
    grind_setting: v.grind_setting,
    grinder: grinderName,
    drawdown_min_s: v.drawdown_min_s,
    drawdown_max_s: v.drawdown_max_s,
    tds_min: v.tds_min,
    tds_max: v.tds_max,
    ey_min: v.ey_min,
    ey_max: v.ey_max,
    steps: v.steps,
  };
}

export type NewSessionInput = {
  userId: string;
  recipeId: string;
  versionId: string;
  versionNo: number;
  latestVersionNo: number;
  handle: string;
  slug: string;
  recipeName: string;
  method: BrewMethod;
  entry: 'timer' | 'log';
  version: SessionVersion;
  quickChange?: QuickChange | null;
};

/** A new session: a fresh brew id, a timer in prep (for the timer entry), no form draft yet. */
export function createSession(
  input: NewSessionInput,
  now: number = Date.now(),
  id: string = globalThis.crypto.randomUUID(),
): BrewSession {
  return {
    v: 1,
    id,
    userId: input.userId,
    recipeId: input.recipeId,
    versionId: input.versionId,
    versionNo: input.versionNo,
    latestVersionNo: input.latestVersionNo,
    handle: input.handle,
    slug: input.slug,
    recipeName: input.recipeName,
    method: input.method,
    entry: input.entry,
    version: input.version,
    quickChange: input.quickChange ?? null,
    timer: input.entry === 'timer' ? createTimerState(input.version.steps) : null,
    form: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function withTimer(session: BrewSession, timer: TimerState): BrewSession {
  return { ...session, timer };
}

export function withForm(session: BrewSession, form: BrewLogDraft): BrewSession {
  return { ...session, form };
}

/**
 * Where an open session stands, for the cards on Home: still on the prep screen, brewing, a long
 * steep under way, or finished and waiting for its log (including every log-only session).
 */
export type SessionStage = 'preparing' | 'brewing' | 'steeping' | 'logging';

export function sessionStage(session: BrewSession): SessionStage {
  const timer = session.timer;
  if (!timer || timer.phase === 'done') return 'logging';
  if (timer.phase === 'prep') return 'preparing';
  return timer.mode === 'steep' ? 'steeping' : 'brewing';
}

/** The version a new version would be numbered after the latest, for "Saves as v4". */
export function nextVersionNo(session: Pick<BrewSession, 'latestVersionNo'>): number {
  return session.latestVersionNo + 1;
}
