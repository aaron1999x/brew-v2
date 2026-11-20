import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompareView } from '@/components/recipes/CompareView';
import { HydratedRecipe } from '@/components/recipes/HydratedRecipe';
import { parseVersionNo, versionByNo } from '@/lib/recipes/fetch';
import { getOwnedRecipe } from '@/lib/recipes/server';

type Params = { handle: string; slug: string };
type Search = { a?: string | string[]; b?: string | string[] };

export const metadata: Metadata = { title: 'Compare versions', robots: { index: false, follow: false } };

export default async function CompareRoute({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ handle, slug }, search] = await Promise.all([params, searchParams]);
  const { data } = await getOwnedRecipe(handle, slug);
  const a = parseVersionNo(search.a);
  const b = parseVersionNo(search.b);
  // A version in the URL that doesn't exist is a real 404; one that's left out takes the default.
  const given = [
    [search.a, a],
    [search.b, b],
  ] as const;
  for (const [raw, parsed] of given) {
    if (raw !== undefined && (parsed === null || !versionByNo(data.versions, parsed))) notFound();
  }
  return (
    <HydratedRecipe handle={handle} slug={slug}>
      <CompareView handle={handle} slug={slug} a={a} b={b} />
    </HydratedRecipe>
  );
}
