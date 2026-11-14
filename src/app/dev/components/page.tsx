import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DevComponents } from '@/components/dev/DevComponents';
import { isDevToolsEnabled } from '@/lib/dev-tools';

export const metadata: Metadata = {
  title: 'Components',
  robots: { index: false, follow: false },
};

export default function ComponentsPage() {
  // Literal name so Next inlines it at build time. Production serves the shared 404.
  if (!isDevToolsEnabled(process.env.NEXT_PUBLIC_APP_ENV)) notFound();
  return <DevComponents />;
}
