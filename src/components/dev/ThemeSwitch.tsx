'use client';

import { useEffect, useState } from 'react';
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl';

type Theme = 'system' | 'light' | 'dark';

const segments = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Dev-only theme override. Nothing is persisted; a user setting arrives in M2. */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    return () => root.removeAttribute('data-theme');
  }, [theme]);

  return (
    <SegmentedControl
      label="Theme"
      segments={segments}
      value={theme}
      onChange={(next) => setTheme(next as Theme)}
    />
  );
}
