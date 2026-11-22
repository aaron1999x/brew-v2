'use client';

import dynamic from 'next/dynamic';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton/Skeleton';

/** The taste radar, loaded when it is needed (Recharts is large); a skeleton holds the space. */
export const LazyTasteRadar = dynamic(
  () => import('./TasteRadarChart').then((module) => module.TasteRadarChart),
  {
    ssr: false,
    loading: () => (
      <LoadingRegion label="taste chart">
        <Skeleton width="full" />
        <Skeleton width="full" />
      </LoadingRegion>
    ),
  },
);
