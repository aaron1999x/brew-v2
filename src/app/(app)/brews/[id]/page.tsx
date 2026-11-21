import type { Metadata } from 'next';
import { BrewDetail } from '@/components/brews/log/BrewDetail';
import { requireOwnBrew } from '@/lib/brews/server';

export const metadata: Metadata = { title: 'Brew', robots: { index: false, follow: false } };

/** `/brews/[id]`: another person's brew, a deleted one and a wrong id are all the same 404. */
export default async function BrewRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOwnBrew(id);
  return <BrewDetail id={id} />;
}
