'use client';

import Link from 'next/link';
import { appVersion } from '@/lib/version';
import { useHasNewVersion } from '@/lib/lastViewedVersion';
import styles from './VersionBadge.module.css';

type Props = {
  /** Defaults to the running app's version; a prop so tests can pass one. */
  version?: string;
};

/**
 * "v0.1.0", linking to /changelog. A dot marks a version newer than the last one viewed there.
 * The visible text is short; the accessible name says what the link is for (and "new" with the dot).
 */
export function VersionBadge({ version = appVersion }: Props) {
  const isNew = useHasNewVersion(version);
  return (
    <Link
      href="/changelog"
      className={styles.badge}
      aria-label={`Version ${version}, view changelog${isNew ? ', new' : ''}`}
      data-primary-control=""
    >
      <span className="num">v{version}</span>
      {isNew ? <span className={styles.dot} aria-hidden="true" data-new="" /> : null}
    </Link>
  );
}
