'use client';

import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { LoadingRegion, SkeletonRow } from '@/components/ui/Skeleton/Skeleton';
import { StillLoading, useStillLoading } from '@/components/ui/StillLoading/StillLoading';

type Props = {
  /** What is loading, spoken as "Loading <label>" and used in the error title. */
  label: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  children: ReactNode;
};

/** The loading / error half of the screen standard (docs/phase-4-amendments.md §3). */
export function QueryBoundary({ label, isLoading, isError, onRetry, children }: Props) {
  const still = useStillLoading(isLoading);
  if (isLoading) {
    return (
      <>
        <LoadingRegion label={label}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </LoadingRegion>
        {still ? <StillLoading onRetry={onRetry} /> : null}
      </>
    );
  }
  if (isError) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title={`Couldn't load ${label}`}
        text="Check your connection and try again."
        action={<Button onPress={onRetry}>Retry</Button>}
      />
    );
  }
  return <>{children}</>;
}
