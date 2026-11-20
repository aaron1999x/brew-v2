'use client';

import dynamic from 'next/dynamic';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton/Skeleton';

/**
 * The pour curve, loaded when it is needed. Recharts is large, so it is fetched on recipe and
 * compare pages only (never with the rest of the app), and a skeleton holds the space until then.
 */
export const LazyPourCurve = dynamic(
  () => import('./PourCurveChart').then((module) => module.PourCurveChart),
  {
    ssr: false,
    loading: () => (
      <LoadingRegion label="pour curve">
        <Skeleton width="full" />
        <Skeleton width="full" />
      </LoadingRegion>
    ),
  },
);
