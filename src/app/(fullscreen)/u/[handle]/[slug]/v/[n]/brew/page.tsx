import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrewTimerScreen } from '@/components/brews/timer/BrewTimerScreen';
import { parseVersionNo, versionByNo } from '@/lib/recipes/fetch';
import { getOwnedRecipe } from '@/lib/recipes/server';

type Params = { handle: string; slug: string; n: string };
type Search = { session?: string | string[] };

export const metadata: Metadata = { title: 'Brew', robots: { index: false, follow: false } };

/**
 * `/@handle/slug/v/N/brew?session=<id>`: the guided timer for a brew session on this device.
 * Someone else's recipe, or a version that doesn't exist, is the same "not available" 404 as
 * anywhere else. (M7 opens this to visitors for public recipes.)
 */
export default async function BrewTimerRoute({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ handle, slug, n }, search] = await Promise.all([params, searchParams]);
  const { data } = await getOwnedRecipe(handle, slug);
  const versionNo = parseVersionNo(n);
  const version = versionNo === null ? null : versionByNo(data.versions, versionNo);
  if (!version) notFound();
  const session = Array.isArray(search.session) ? search.session[0] : search.session;
  return (
    <BrewTimerScreen
      handle={data.owner.handle}
      slug={data.recipe.slug}
      versionNo={version.version_no}
      versionId={version.id}
      sessionId={session ?? null}
    />
  );
}
