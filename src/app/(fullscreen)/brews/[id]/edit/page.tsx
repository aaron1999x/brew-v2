import type { Metadata } from 'next';
import { EditBrewScreen } from '@/components/brews/log/EditBrewScreen';
import { requireOwnBrew } from '@/lib/brews/server';

export const metadata: Metadata = { title: 'Edit brew', robots: { index: false, follow: false } };

export default async function EditBrewRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOwnBrew(id);
  return <EditBrewScreen id={id} />;
}
