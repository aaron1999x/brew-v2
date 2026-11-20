import { recipePath, versionPath } from '@/lib/recipes/paths';

/** `/@handle/slug/v/3/brew?session=<id>`: the guided timer for a brew session. */
export function brewTimerPath(handle: string, slug: string, versionNo: number, sessionId: string): string {
  return `${versionPath(handle, slug, versionNo)}/brew?session=${encodeURIComponent(sessionId)}`;
}

/**
 * The recipe page with the choice sheet open ("Guided timer" or "Log only"). Every "Brew again"
 * button links here, and a timer link with a missing session comes back here.
 */
export function brewChoicePath(handle: string, slug: string, versionNo?: number | null): string {
  const base = versionNo == null ? recipePath(handle, slug) : versionPath(handle, slug, versionNo);
  return `${base}?brew=1`;
}

/** `/brews/new?session=<id>`: the log form for a brew session. */
export function brewLogPath(sessionId: string): string {
  return `/brews/new?session=${encodeURIComponent(sessionId)}`;
}
