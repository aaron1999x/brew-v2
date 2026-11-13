'use client';

import { useEffect, useRef } from 'react';
import styles from './ErrorPanel.module.css';

type Props = {
  title: string;
  message: string;
  /** When given, a Retry button is shown. */
  onRetry?: () => void;
  /** Hide the "Go to home" link (e.g. on the offline page, where home wouldn't load either). */
  showHomeLink?: boolean;
};

/**
 * Error panel from docs/phase-4-amendments.md §3: what happened, Retry, link home.
 * The heading takes focus on mount so screen-reader and keyboard users land on the message.
 * Uses a plain <a>: it must also work from global-error, where the router may be unavailable.
 */
export function ErrorPanel({ title, message, onRetry, showHomeLink = true }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className={styles.panel}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        {title}
      </h1>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        {onRetry ? (
          <button type="button" className={styles.primary} onClick={onRetry}>
            Retry
          </button>
        ) : null}
        {showHomeLink ? (
          <>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full page load on purpose: recovers from broken client state and works inside global-error */}
            <a className={onRetry ? styles.secondary : styles.primary} href="/">
              Go to home
            </a>
          </>
        ) : null}
      </div>
    </main>
  );
}
