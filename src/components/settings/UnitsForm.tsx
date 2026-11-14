'use client';

import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { useSettings, useUpdateSettings } from '@/lib/settings/useSettings';
import { UnitsFields } from './UnitsFields';

/** /settings/units: each choice saves as soon as it changes and the preview line follows. */
export function UnitsForm() {
  const settings = useSettings();
  const update = useUpdateSettings({ successMessage: 'Saved.' });
  return (
    <QueryBoundary
      label="your units"
      isLoading={settings.isPending}
      isError={settings.isError}
      onRetry={() => void settings.refetch()}
    >
      {settings.data ? (
        <UnitsFields value={settings.data} onChange={(patch) => update.mutate(patch)} />
      ) : null}
    </QueryBoundary>
  );
}
