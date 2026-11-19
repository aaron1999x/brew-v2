import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RecipeEditor } from '@/components/recipes/editor/RecipeEditor';
import { parseVersionNo, versionByNo } from '@/lib/recipes/fetch';
import { getOwnedRecipe } from '@/lib/recipes/server';

type Params = { handle: string; slug: string };
type Search = { from?: string | string[] };

export const metadata: Metadata = { title: 'New version', robots: { index: false, follow: false } };

/** `/@handle/slug/new-version?from=N`: the next version, started from version N (default: the latest). */
export default async function NewVersionRoute({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ handle, slug }, search] = await Promise.all([params, searchParams]);
  const { data } = await getOwnedRecipe(handle, slug);
  const from = parseVersionNo(search.from);
  if (search.from !== undefined && from === null) notFound();
  const version = versionByNo(data.versions, from);
  if (!version) notFound();
  return (
    <RecipeEditor
      mode="new-version"
      base={{ handle: data.owner.handle, recipe: data.recipe, version, latestNo: data.version.version_no }}
    />
  );
}
