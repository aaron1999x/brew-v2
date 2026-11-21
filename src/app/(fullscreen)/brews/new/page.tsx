import type { Metadata } from 'next';
import { NewBrewScreen } from '@/components/brews/log/NewBrewScreen';

export const metadata: Metadata = { title: 'Log brew', robots: { index: false, follow: false } };

type Search = { session?: string | string[] };

/** `/brews/new?session=<id>`: the log for a brew session kept on this device. */
export default async function NewBrewRoute({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const session = Array.isArray(search.session) ? search.session[0] : search.session;
  return <NewBrewScreen sessionId={session ?? null} />;
}
