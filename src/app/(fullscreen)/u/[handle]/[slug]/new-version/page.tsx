import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RecipeEditor } from '@/components/recipes/editor/RecipeEditor';
import type { PinnedBrew } from '@/components/recipes/editor/PinnedBrewNote';
import { createClient } from '@/lib/supabase/server';
import { parseVersionNo, versionByNo } from '@/lib/recipes/fetch';
import { getOwnedRecipe } from '@/lib/recipes/server';
import { PageShell } from '@/components/shell/PageShell';

type Params = { handle: string; slug: string };
type Search = { from?: string | string[]; brew?: string | string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTE_PREVIEW = 200;

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
  // "Create next version" from a brew: pin what that brew said to change. A brew of another recipe,
  // a deleted one or a bad id simply shows no note.
  let fromBrew: PinnedBrew | null = null;
  const brewId = Array.isArray(search.brew) ? search.brew[0] : search.brew;
  if (brewId && UUID.test(brewId)) {
    const { data: brew } = await (
      await createClient()
    )
      .from('brews')
      .select('id, brewed_at, overall, notes, next_change, recipe_id')
      .eq('id', brewId)
      .is('deleted_at', null)
      .maybeSingle();
    const text = brew?.next_change?.trim() || brew?.notes?.trim().slice(0, NOTE_PREVIEW) || '';
    if (brew && brew.recipe_id === data.recipe.id && text) {
      fromBrew = { id: brew.id, brewedAt: brew.brewed_at, overall: brew.overall, text };
    }
  }
  return (
    <PageShell>
      <RecipeEditor
        fromBrew={fromBrew}
        mode="new-version"
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
