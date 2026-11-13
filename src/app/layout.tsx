import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
