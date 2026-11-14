import type { Metadata } from 'next';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { TopBar } from '@/components/shell/TopBar';
import { requireUser } from '@/lib/auth/server';
import styles from '../../shell.module.css';

export const metadata: Metadata = { title: 'Edit profile' };

export default async function EditProfilePage() {
  await requireUser('/settings/profile');
  return (
    <>
      <TopBar title="Edit profile" backHref="/profile" />
      <div className={styles.body}>
        <ProfileForm />
      </div>
    </>
  );
}
