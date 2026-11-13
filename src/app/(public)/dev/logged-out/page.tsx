import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { isDevToolsEnabled } from '@/lib/dev-tools';

export const metadata: Metadata = {
  title: 'Logged-out shell',
  robots: { index: false, follow: false },
};

/** Dev-only view of the logged-out layout. */
export default function LoggedOutPreview() {
  if (!isDevToolsEnabled(process.env.NEXT_PUBLIC_APP_ENV)) notFound();
  return (
    <>
      <h1>Logged-out layout</h1>
      <EmptyState
        title="Verified recipes from trusted brewers will appear here soon."
        text="This page only shows the logged-out layout: a slim top bar and no tab bar."
      />
    </>
  );
}
