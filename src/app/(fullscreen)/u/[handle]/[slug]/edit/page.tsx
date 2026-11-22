import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RecipeEditor } from '@/components/recipes/editor/RecipeEditor';
import { parseVersionNo, versionByNo } from '@/lib/recipes/fetch';
import { getOwnedRecipe } from '@/lib/recipes/server';
import { PageShell } from '@/components/shell/PageShell';

type Params = { handle: string; slug: string };
type Search = { v?: string | string[] };

export const metadata: Metadata = { title: 'Edit recipe', robots: { index: false, follow: false } };

/** `/@handle/slug/edit?v=N`: edit one version (the latest when `v` is left out). */
export default async function EditRoute({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ handle, slug }, search] = await Promise.all([params, searchParams]);
  const { data } = await getOwnedRecipe(handle, slug);
  const wanted = parseVersionNo(search.v);
  if (search.v !== undefined && wanted === null) notFound();
  const version = versionByNo(data.versions, wanted);
  if (!version) notFound();
  return (
    <PageShell>
      <RecipeEditor
        mode="edit"
        base={{
          handle: data.owner.handle,
          recipe: data.recipe,
          version,
          latestNo: data.version.version_no,
        }}
      />
    </PageShell>
  );
}
