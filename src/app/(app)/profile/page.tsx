import type { Metadata } from 'next';
import { Bookmark } from 'lucide-react';
import { TopBar } from '@/components/shell/TopBar';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import styles from '../shell.module.css';

export const metadata: Metadata = { title: 'Profile' };

export default function ProfilePage() {
  return (
    <>
      <TopBar title="Profile" />
      <div className={styles.body}>
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet."
          text="Recipes you save from other brewers appear here."
          action={
            <ButtonLink href="/verified" variant="secondary">
              Verified
            </ButtonLink>
          }
        />
      </div>
    </>
  );
}
