import type { Metadata } from 'next';
import { HydratedRecipe } from '@/components/recipes/HydratedRecipe';
import { VersionHistory } from '@/components/recipes/VersionHistory';
import { PageShell } from '@/components/shell/PageShell';

type Params = { handle: string; slug: string };

export const metadata: Metadata = { title: 'Versions', robots: { index: false, follow: false } };

export default async function VersionsRoute({ params }: { params: Promise<Params> }) {
  const { handle, slug } = await params;
  return (
    <PageShell>
      <HydratedRecipe handle={handle} slug={slug}>
        <VersionHistory handle={handle} slug={slug} />
      </HydratedRecipe>
    </PageShell>
  );
}
