import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MyRecipes } from '@/components/recipes/list/MyRecipes';
import { TopBar } from '@/components/shell/TopBar';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { LoadingRegion, SkeletonRow } from '@/components/ui/Skeleton/Skeleton';
import { requireUser } from '@/lib/auth/server';
import styles from '../shell.module.css';

export const metadata: Metadata = { title: 'Recipes' };

export default async function RecipesPage() {
  await requireUser('/recipes');
  return (
    <>
      <TopBar title="Recipes" actions={<ButtonLink href="/recipes/new">New recipe</ButtonLink>} />
      <div className={styles.bodyWide}>
        <Suspense
          fallback={
            <LoadingRegion label="recipes">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </LoadingRegion>
          }
        >
          <MyRecipes />
        </Suspense>
      </div>
    </>
  );
}
