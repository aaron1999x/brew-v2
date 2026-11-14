import type { Metadata } from 'next';
import { SettingsList, type SettingsLink } from '@/components/settings/SettingsList';
import { TopBar } from '@/components/shell/TopBar';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { getAccountStatus, requireUser } from '@/lib/auth/server';
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

const ACCOUNT_LINK: SettingsLink = {
  href: '/settings/account',
  label: 'Account',
  hint: 'Password, download my data, delete account',
};
const ADMIN_LINK: SettingsLink = {
  href: '/admin/invites',
  label: 'Invites',
  hint: 'Who can sign up (admins only)',
};

export default async function SettingsPage() {
  await requireUser('/settings');
  const status = await getAccountStatus();
  const links = [...LINKS, ACCOUNT_LINK, ...(status?.role === 'admin' ? [ADMIN_LINK] : [])];
  return (
    <>
      <TopBar title="Settings" backHref="/profile" />
      <div className={styles.body}>
        <SettingsList links={links} />
        <SignOutButton />
      </div>
    </>
  );
}
