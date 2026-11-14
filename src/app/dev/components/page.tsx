import type { Metadata } from 'next';
import { DevComponents } from '@/components/dev/DevComponents';

export const metadata: Metadata = {
  title: 'Components',
  // Public by choice during development, but kept out of search engines (robots.ts disallows /dev/ too).
  robots: { index: false, follow: false },
};

/** The component gallery renders in every environment, production included. */
export default function ComponentsPage() {
  return <DevComponents />;
}
