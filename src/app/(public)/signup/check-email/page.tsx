import type { Metadata } from 'next';
import { CheckEmail } from './CheckEmail';
import { PageShell } from '@/components/shell/PageShell';

export const metadata: Metadata = { title: 'Check your email' };

export default function CheckEmailPage() {
  return (
    <PageShell width="narrow">
      <CheckEmail />
    </PageShell>
  );
}
