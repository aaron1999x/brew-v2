import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HydratedRecipe } from '@/components/recipes/HydratedRecipe';
import { RecipePage } from '@/components/recipes/RecipePage';
import { parseVersionNo, versionByNo } from '@/lib/recipes/fetch';
import { getOwnedRecipe } from '@/lib/recipes/server';

type Params = { handle: string; slug: string; n: string };

export const metadata: Metadata = { title: 'Version', robots: { index: false, follow: false } };

export default async function VersionRoute({ params }: { params: Promise<Params> }) {
  const { handle, slug, n } = await params;
  const versionNo = parseVersionNo(n);
  const { data } = await getOwnedRecipe(handle, slug);
  // A version that doesn't exist is as "not available" as a recipe that doesn't (a real 404).
  if (versionNo === null || !versionByNo(data.versions, versionNo)) notFound();
  return (
    <HydratedRecipe handle={handle} slug={slug}>
      <RecipePage handle={handle} slug={slug} versionNo={versionNo} />
    </HydratedRecipe>
  );
}
