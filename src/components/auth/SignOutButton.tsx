'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTransition } from 'react';
import { signOutAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/Button/Button';
import { toast } from '@/components/ui/Toast/toast';
import { toUserMessage } from '@/lib/errors/messages';

/** Log out: clears the TanStack Query cache, ends the session on the server, goes to /login. */
export function SignOutButton() {
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      try {
        queryClient.clear();
        await signOutAction();
      } catch (error) {
        toast.error(toUserMessage(error), { onRetry: signOut });
      }
    });
  }

  return (
    <Button
      variant="secondary"
      size="lg"
      isPending={pending}
      pendingLabel="Logging out…"
      onPress={signOut}
    >
      Log out
    </Button>
  );
}
