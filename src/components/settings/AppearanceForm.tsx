'use client';

import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl';
import { applyTheme, isTheme } from '@/lib/settings/theme';
import { useSettings, useUpdateSettings } from '@/lib/settings/useSettings';
import styles from './Settings.module.css';

const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** /settings/appearance: the theme applies at once, is saved to the account and to a cookie. */
export function AppearanceForm() {
  const settings = useSettings();
  const update = useUpdateSettings({ successMessage: 'Saved.' });
  return (
    <QueryBoundary
      label="your appearance settings"
      isLoading={settings.isPending}
      isError={settings.isError}
      onRetry={() => void settings.refetch()}
    >
      {settings.data ? (
        <div className={styles.form}>
          <SegmentedControl
            label="Theme"
            segments={THEMES}
            value={settings.data.theme}
            onChange={(value) => {
              if (!isTheme(value)) return;
              applyTheme(value);
              update.mutate({ theme: value });
            }}
          />
          <p>System follows your device&apos;s light or dark setting.</p>
        </div>
      ) : null}
    </QueryBoundary>
  );
}
