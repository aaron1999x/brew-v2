import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import styles from './Skeleton.module.css';

/** A grey placeholder block. Purely visual; wrap groups in <LoadingRegion>. */
export function Skeleton({
  width,
  className,
}: {
  width?: 'short' | 'medium' | 'full';
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cx(styles.block, width && styles[width], className)} />
  );
}

export function SkeletonCard() {
  return (
    <div className={styles.card} aria-hidden="true">
      <Skeleton width="medium" />
      <Skeleton width="short" />
      <Skeleton width="full" className={styles.tall} />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className={styles.row} aria-hidden="true">
      <span className={cx(styles.block, styles.circle)} />
      <span className={styles.rowText}>
        <Skeleton width="medium" />
        <Skeleton width="short" />
      </span>
    </div>
  );
}

type RegionProps = {
  /** What is loading, e.g. "recipes". Announced once, politely, as "Loading recipes". */
  label: string;
  children: ReactNode;
};

/**
 * Container for skeletons: aria-busy while they show, with one polite announcement.
 * Remove it (render the real content) when loading finishes.
 */
export function LoadingRegion({ label, children }: RegionProps) {
  return (
    <div aria-busy="true" className={styles.region}>
      <VisuallyHidden>
        <span role="status">{`Loading ${label}`}</span>
      </VisuallyHidden>
      {children}
    </div>
  );
}
