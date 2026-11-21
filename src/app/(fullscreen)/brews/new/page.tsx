import type { Metadata } from 'next';
import { PlaceholderLog } from '@/components/brews/PlaceholderLog';

export const metadata: Metadata = { title: 'Log brew', robots: { index: false, follow: false } };

type Search = { session?: string | string[] };

/** TEMPORARY (Stage 3): replaced by the real log form in Stage 4. */
export default async function NewBrewRoute({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const session = Array.isArray(search.session) ? search.session[0] : search.session;
  return <PlaceholderLog sessionId={session ?? null} />;
}
