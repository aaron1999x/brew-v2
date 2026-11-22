import type { Metadata } from 'next';
import { RecipeEditor } from '@/components/recipes/editor/RecipeEditor';
import { requireUser } from '@/lib/auth/server';
import { PageShell } from '@/components/shell/PageShell';

export const metadata: Metadata = { title: 'New recipe' };

export default async function NewRecipePage() {
  await requireUser('/recipes/new');
  return (
    <PageShell>
      <RecipeEditor />
    </PageShell>
  );
}
