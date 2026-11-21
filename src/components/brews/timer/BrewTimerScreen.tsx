'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { LoadingRegion, SkeletonCard } from '@/components/ui/Skeleton/Skeleton';
import { brewChoicePath, brewLogPath } from '@/lib/brews/paths';
import { useBrewSession } from '@/lib/brews/useBrewSessions';
import { PrepScreen } from './PrepScreen';
import { RunRoot } from './RunRoot';
import styles from './timer.module.css';

type Props = Readonly<{
  handle: string;
  slug: string;
  versionNo: number;
  versionId: string;
  /** From `?session=`. */
  sessionId: string | null;
}>;

/**
 * Opens the brew session in the URL and shows the right screen for where it stands: prep, the
 * running timer (resumed with the right time after a reload), or, once it has ended, the log. A
 * missing session, someone else's, or one for another version goes back to the choice sheet.
 */
export function BrewTimerScreen({ handle, slug, versionNo, versionId, sessionId }: Props) {
  const router = useRouter();
  const { session, ready, update, remove } = useBrewSession(sessionId);
  const leaving = useRef(false);

  const leave = useCallback(
    (path: string, options?: { discard?: boolean }) => {
      leaving.current = true;
      router.replace(path);
      if (options?.discard) remove();
    },
    [router, remove],
  );

  const belongsHere =
    session != null &&
    session.versionId === versionId &&
    session.handle.toLowerCase() === handle.toLowerCase() &&
    session.slug === slug;

  useEffect(() => {
    if (!ready || leaving.current) return;
    if (!belongsHere) router.replace(brewChoicePath(handle, slug, versionNo));
    else if (!session.timer) router.replace(brewLogPath(session.id));
  }, [ready, belongsHere, session, router, handle, slug, versionNo]);

  if (!ready || !belongsHere || !session.timer) {
    return (
      <div className={styles.screen}>
        <LoadingRegion label="brew timer">
          <SkeletonCard />
        </LoadingRegion>
      </div>
    );
  }

  return session.timer.phase === 'prep' ? (
    <PrepScreen key={session.id} session={session} update={update} />
  ) : (
    <RunRoot key={session.id} session={session} update={update} leave={leave} />
  );
}
