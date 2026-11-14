import type { Metadata } from 'next';
import { Bookmark } from 'lucide-react';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { TopBar } from '@/components/shell/TopBar';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { VersionBadge } from '@/components/ui/VersionBadge/VersionBadge';
import { requireUser } from '@/lib/auth/server';
import styles from '../shell.module.css';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  await requireUser('/profile');
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
        <SignOutButton />
        <div className={styles.versionRow}>
          <VersionBadge />
        </div>
      </div>
    </>
  );
}
