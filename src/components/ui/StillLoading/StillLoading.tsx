'use client';

import { useEffect, useState } from 'react';
import { Button } from '../Button/Button';
import styles from './StillLoading.module.css';

/** The standard says to offer a way out after 10 s of skeletons (docs/phase-4-amendments.md §3). */
export const STILL_LOADING_MS = 10_000;

/** True once `isLoading` has been true for `ms` without interruption. Resets when loading ends. */
export function useStillLoading(isLoading: boolean, ms: number = STILL_LOADING_MS): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => {
      clearTimeout(timer);
      // Leaving the loading state (or changing `ms`) starts the next wait from zero.
      setElapsed(false);
    };
  }, [isLoading, ms]);

  return isLoading && elapsed;
}

/** "Still loading…" with Retry. The text is a polite status, so it is announced once. */
export function StillLoading({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.still}>
      <p role="status">Still loading…</p>
      <Button variant="secondary" onPress={onRetry}>
        Retry
      </Button>
    </div>
  );
}
