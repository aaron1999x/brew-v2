'use client';

import { useActionState } from 'react';
import { AuthCard } from '@/components/auth/AuthCard';
import { ExpiredLink } from '@/components/auth/ExpiredLink';
import { Button } from '@/components/ui/Button/Button';
import type { ConfirmType } from '@/lib/auth/constants';
import { confirmAction, type ConfirmState } from './actions';

type Props = { tokenHash: string; type: ConfirmType };

/** One button that spends the token. Nothing happens until a person presses it. */
export function ConfirmForm({ tokenHash, type }: Props) {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmAction, undefined);
  const recovery = type === 'recovery';

  if (state?.error) return <ExpiredLink recovery={recovery} />;

  return (
    <AuthCard
      title={recovery ? 'Choose a new password' : 'Confirm your email'}
      description={
        recovery
          ? 'Press the button to continue and choose a new password.'
          : 'Press the button to finish creating your account.'
      }
    >
      <form action={action}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <Button type="submit" size="lg" fullWidth isPending={pending} pendingLabel="Checking…">
          {recovery ? 'Continue' : 'Confirm email'}
        </Button>
      </form>
    </AuthCard>
  );
}
