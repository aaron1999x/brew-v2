import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';
import { TopBar } from '@/components/shell/TopBar';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import styles from '../shell.module.css';

export const metadata: Metadata = { title: 'Recipes' };

export default function RecipesPage() {
  return (
    <>
      <TopBar title="Recipes" />
      <div className={styles.body}>
        <EmptyState
          icon={BookOpen}
          title="No recipes yet."
          text="Every recipe you create is private until you share it."
          action={<ButtonLink href="/recipes">New recipe</ButtonLink>}
        />
      </div>
    </>
  );
}
