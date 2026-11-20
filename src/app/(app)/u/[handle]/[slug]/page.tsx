import type { Metadata } from 'next';
import { HydratedRecipe } from '@/components/recipes/HydratedRecipe';
import { RecipePage } from '@/components/recipes/RecipePage';
import { getUser } from '@/lib/auth/server';
import { getRecipeBySlug } from '@/lib/recipes/server';

type Params = { handle: string; slug: string };

/** Private recipes must not be indexed, and their title only shows to the owner. */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { handle, slug } = await params;
  const user = await getUser();
  const data = user ? await getRecipeBySlug(handle, slug) : null;
  return {
    title: data?.owner.id === user?.id && data ? data.recipe.name : 'Not available',
    robots: { index: false, follow: false },
  };
}

export default async function RecipeRoute({ params }: { params: Promise<Params> }) {
  const { handle, slug } = await params;
  return (
    <HydratedRecipe handle={handle} slug={slug}>
      <RecipePage handle={handle} slug={slug} />
    </HydratedRecipe>
  );
}
