import { SerwistProvider } from '@serwist/turbopack/react';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Suspense, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { FlashToast } from '@/components/feedback/FlashToast';
import { Providers } from '@/components/providers/Providers';
import { siteConfig } from '@/config/site';
import { THEME_COOKIE, isTheme, themeAttribute } from '@/lib/settings/theme';
import { inter } from './fonts';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/toaster.css';

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  applicationName: siteConfig.name,
  // iOS "Add to Home Screen": full-screen web app with its own name and icon.
  appleWebApp: { capable: true, title: siteConfig.shortName, statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/brand/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: siteConfig.themeColor.light },
    { media: '(prefers-color-scheme: dark)', color: siteConfig.themeColor.dark },
  ],
};

/**
 * The saved theme is read from a cookie so the very first response already carries `data-theme`
 * (no flash). Visitors have no cookie and follow the system. This makes every page dynamic.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieTheme = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(cookieTheme) ? themeAttribute(cookieTheme) : undefined;
  return (
    <html lang="en" className={inter.variable} data-theme={theme}>
      <body>
        <SerwistProvider
          swUrl="/serwist/sw.js"
          // The worker is registered in production builds only, so dev never serves stale caches.
          disable={process.env.NODE_ENV === 'development'}
          reloadOnOnline={false}
        >
          <Providers>{children}</Providers>
        </SerwistProvider>
        {/* Toasts stay >= 5 s and pause on hover/focus (docs/phase-4-amendments.md §3). */}
        <Toaster theme="system" position="top-center" duration={6000} closeButton />
        <Suspense fallback={null}>
          <FlashToast />
        </Suspense>
      </body>
    </html>
  );
}
