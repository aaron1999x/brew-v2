'use client';

import { useEffect, useState } from 'react';
import styles from './dev.module.css';

type Theme = 'system' | 'light' | 'dark';

const options: { value: Theme; label: string }[] = [
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

  function choose(next: Theme) {
    setTheme(next);
  }

  return (
    <fieldset className={styles.themeSwitch}>
      <legend className={styles.themeLegend}>Theme</legend>
      {options.map((o) => (
        <label key={o.value} className={styles.themeOption}>
          <input
            type="radio"
            name="dev-theme"
            value={o.value}
            checked={theme === o.value}
            onChange={() => choose(o.value)}
            className={styles.themeInput}
          />
          <span className={styles.themeText} data-primary-control>
            {o.label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
