import { useEffect, useSyncExternalStore } from 'react';

const KEY = 'lastViewedVersion';
const CHANGE_EVENT = 'lastviewedversion:change';

/** Compares "1.2.3" style versions (a pre-release suffix is ignored). Negative, 0 or positive. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .split('-')[0]!
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** True when the app is newer than the version last viewed. Nothing stored means "not newer". */
export function isNewerThan(current: string, lastViewed: string | null): boolean {
  return lastViewed !== null && compareVersions(current, lastViewed) > 0;
}

// Browser storage can throw (private windows, blocked site data), so every access is guarded.
export function readLastViewed(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeLastViewed(version: string): void {
  try {
    window.localStorage.setItem(KEY, version);
  } catch {
    return;
  }
  // The `storage` event only fires in other tabs, so tell this tab's subscribers ourselves.
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * Whether to show the "new" dot for `current`. Renders without the dot on the server and while
 * hydrating. On the very first visit nothing is stored: the current version is saved silently, so
 * the dot only appears after a later release.
 */
export function useHasNewVersion(current: string): boolean {
  const lastViewed = useSyncExternalStore(subscribe, readLastViewed, () => null);

  useEffect(() => {
    // Read storage directly: while hydrating, `lastViewed` is still the server snapshot (null) and
    // acting on it would overwrite a real stored version.
    if (readLastViewed() === null) writeLastViewed(current);
  }, [current]);

  return isNewerThan(current, lastViewed);
}
