import type { Metadata } from 'next';
import { ExpiredLink } from '@/components/auth/ExpiredLink';
import { isConfirmType } from '@/lib/auth/constants';
import { ConfirmForm } from './ConfirmForm';

// The link carries a one-time token: keep it out of search engines and out of Referer headers.
export const metadata: Metadata = {
  title: 'Confirm',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type Props = { searchParams: Promise<{ token_hash?: string; type?: string }> };

/**
 * GET never verifies anything (email scanners open links). It only renders a button that posts
 * to `confirmAction`.
 */
export default async function ConfirmPage({ searchParams }: Props) {
  const { token_hash, type } = await searchParams;
  if (!token_hash || !isConfirmType(type)) return <ExpiredLink recovery={type === 'recovery'} />;
  return <ConfirmForm tokenHash={token_hash} type={type} />;
}
