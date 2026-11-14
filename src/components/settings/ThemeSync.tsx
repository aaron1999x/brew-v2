'use client';

import { useEffect } from 'react';
import { THEME_COOKIE, applyTheme, themeAttribute } from '@/lib/settings/theme';
import { useSettings } from '@/lib/settings/useSettings';

function currentCookie(): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${THEME_COOKIE}=`));
  return match ? match.slice(THEME_COOKIE.length + 1) : null;
}

/**
 * Keeps the page and the `theme` cookie in step with the account's saved theme: a change made on
 * another device shows up here, and a save that failed (and rolled back) undoes the preview.
 * Renders nothing.
 */
export function ThemeSync() {
  const theme = useSettings().data?.theme;

  useEffect(() => {
    if (!theme) return;
    const attribute = document.documentElement.getAttribute('data-theme') ?? undefined;
    if (currentCookie() !== theme || attribute !== themeAttribute(theme)) applyTheme(theme);
  }, [theme]);

  return null;
}
