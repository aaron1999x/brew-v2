import type { Metadata } from 'next';
import { CheckEmail } from './CheckEmail';

export const metadata: Metadata = { title: 'Check your email' };

export default function CheckEmailPage() {
  return <CheckEmail />;
}
