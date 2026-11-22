'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useSession } from '@/lib/auth/useSession';
import type { BrewSession } from './schema';
import {
  parseSessions,
  removeSession,
  sessionsKey,
  updateSession,
  writeSession,
} from './sessions';

const CHANGED = 'brew-sessions:changed';

/** Tells every open component (and, through `storage`, other tabs) that a session changed. */
export function notifySessionsChanged(): void {
  try {
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    /* no window: nothing to tell */
  }
}

/** Saves a session on this device and tells the screens. False when the device refused to store it. */
export function saveSession(userId: string, session: BrewSession): boolean {
  const ok = writeSession(userId, session);
  if (ok) notifySessionsChanged();
  return ok;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

function readRaw(key: string | null): string {
  if (!key) return '';
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

/**
 * The signed-in person's open brew sessions, newest first. localStorage doesn't exist on the
 * server, so the first render is "not ready"; after that the list follows the device's storage
 * (this tab and other tabs).
 */
export function useBrewSessions(): { sessions: BrewSession[]; ready: boolean; userId: string | null } {
  const { user, isLoading } = useSession();
  const userId = user?.id ?? null;
  const key = userId ? sessionsKey(userId) : null;
  // The raw stored text is a string, so React can tell when it hasn't changed.
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
  const sessions = useMemo(() => (userId && raw ? parseSessions(userId, raw) : []), [userId, raw]);
  return { sessions, ready: raw !== null && !isLoading, userId };
}

/** One session by id, with ways to change or remove it. */
export function useBrewSession(id: string | null) {
  const { sessions, ready, userId } = useBrewSessions();
  const session = id ? (sessions.find((s) => s.id === id) ?? null) : null;

  const update = useCallback(
    (change: (current: BrewSession) => BrewSession): BrewSession | null => {
      if (!userId || !id) return null;
      const next = updateSession(userId, id, change);
      notifySessionsChanged();
      return next;
    },
    [userId, id],
  );

  const remove = useCallback((): void => {
    if (!userId || !id) return;
    removeSession(userId, id);
    notifySessionsChanged();
  }, [userId, id]);

  return { session, ready, userId, update, remove };
}

/** Removes any session by id (the Home card's Discard). */
export function discardSession(userId: string, id: string): void {
  removeSession(userId, id);
  notifySessionsChanged();
}
