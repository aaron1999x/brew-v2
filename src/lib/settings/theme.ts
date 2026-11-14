export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Cookie the server reads to render `data-theme` on the very first response (no flash). */
export const THEME_COOKIE = 'theme';
const ONE_YEAR = 60 * 60 * 24 * 365;

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/** `data-theme` for the <html> element; "system" means no attribute (the OS decides). */
export function themeAttribute(theme: Theme): 'light' | 'dark' | undefined {
  return theme === 'system' ? undefined : theme;
}

/** Browser side: writes the cookie and the attribute together. */
export function applyTheme(theme: Theme): void {
  const attr = themeAttribute(theme);
  if (attr) document.documentElement.setAttribute('data-theme', attr);
  else document.documentElement.removeAttribute('data-theme');
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${secure}`;
}

/**
 * Runs in <head> before the page paints: copies the saved theme from the cookie onto <html>, so
 * every page (including static, cacheable public ones) shows the right theme with no flash and
 * without the server having to read cookies. Keep it tiny and dependency-free.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);if(m)document.documentElement.setAttribute('data-theme',m[1])}catch(e){}})();`;
