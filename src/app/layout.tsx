import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { Providers } from '@/components/providers/Providers';
import { siteConfig } from '@/config/site';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/toaster.css';

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        {/* Toasts stay >= 5 s and pause on hover/focus (docs/phase-4-amendments.md §3). */}
        <Toaster theme="system" position="top-center" duration={6000} closeButton />
      </body>
    </html>
  );
}
