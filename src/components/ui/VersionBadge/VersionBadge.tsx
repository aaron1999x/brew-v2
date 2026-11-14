'use client';

import Link from 'next/link';
import { appVersion } from '@/lib/version';
import { useHasNewVersion } from '@/lib/lastViewedVersion';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import styles from './VersionBadge.module.css';

type Props = {
  /** Defaults to the running app's version; a prop so tests can pass one. */
  version?: string;
};

/**
 * "v0.1.0", linking to /changelog. A dot marks a version newer than the last one viewed there.
 * No aria-label: the accessible name is built from the content and starts with the visible
 * text ("v0.1.0, view changelog", plus ", new" with the dot), as WCAG 2.5.3 (label in name) needs.
 */
export function VersionBadge({ version = appVersion }: Props) {
  const isNew = useHasNewVersion(version);
  return (
    <Link href="/changelog" className={styles.badge} data-primary-control="">
      <span className="num">v{version}</span>
      <VisuallyHidden>{`, view changelog${isNew ? ', new' : ''}`}</VisuallyHidden>
      {isNew ? <span className={styles.dot} aria-hidden="true" data-new="" /> : null}
    </Link>
  );
}
