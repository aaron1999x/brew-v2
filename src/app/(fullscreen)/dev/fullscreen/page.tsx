import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { isDevToolsEnabled } from '@/lib/dev-tools';

export const metadata: Metadata = {
  title: 'Fullscreen layout',
  robots: { index: false, follow: false },
};

/** Dev-only view of the fullscreen layout (no tab bar, no top navigation). */
export default function FullscreenPreview() {
  if (!isDevToolsEnabled(process.env.NEXT_PUBLIC_APP_ENV)) notFound();
  return (
    <EmptyState
      title="Fullscreen layout"
      text="No tab bar and no top navigation. The guided timer will live here."
      action={
        <ButtonLink href="/dev/components" variant="secondary">
          Back to components
        </ButtonLink>
      }
    />
  );
}
