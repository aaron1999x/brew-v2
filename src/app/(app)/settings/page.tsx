import type { Metadata } from 'next';
import { SettingsList, type SettingsLink } from '@/components/settings/SettingsList';
import { TopBar } from '@/components/shell/TopBar';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { requireUser } from '@/lib/auth/server';
import styles from '../shell.module.css';

export const metadata: Metadata = { title: 'Settings' };

const LINKS: readonly SettingsLink[] = [
  { href: '/settings/profile', label: 'Profile', hint: 'Photo, name, handle and bio' },
  {
    href: '/settings/units',
    label: 'Units and region',
    hint: 'Temperature, weight, dates and time',
  },
  { href: '/settings/appearance', label: 'Appearance', hint: 'System, light or dark' },
];

export default async function SettingsPage() {
  await requireUser('/settings');
  return (
    <>
      <TopBar title="Settings" backHref="/profile" />
      <div className={styles.body}>
        <SettingsList links={LINKS} />
        <SignOutButton />
      </div>
    </>
  );
}
