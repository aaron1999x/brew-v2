import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { MESSAGE_LINK_EXPIRED } from '@/lib/errors/messages';

/** Shown for a bad, expired or already-used email link, with a way to ask for a new one. */
export function ExpiredLink({ recovery }: { recovery: boolean }) {
  return (
    <AuthCard
      title="Link expired"
      description={MESSAGE_LINK_EXPIRED}
      footer={
        <p>
          <Link href="/login">Back to log in</Link>
        </p>
      }
    >
      {recovery ? (
        <ButtonLink href="/forgot-password" size="lg">
          Get a new link
        </ButtonLink>
      ) : (
        <>
          <p>Log in and we&apos;ll offer to send you a new confirmation email.</p>
          <ButtonLink href="/login" size="lg">
            Log in
          </ButtonLink>
        </>
      )}
    </AuthCard>
  );
}
