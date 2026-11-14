'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { PasswordField } from '@/components/auth/PasswordField';
import { Button } from '@/components/ui/Button/Button';
import { Sheet, SheetActions } from '@/components/ui/Sheet/Sheet';
import { TextField } from '@/components/ui/TextField/TextField';
import { toast } from '@/components/ui/Toast/toast';
import { DELETE_PHRASE } from '@/lib/account/deleteAccount';
import { MESSAGE_FALLBACK, MESSAGE_RATE_LIMITED } from '@/lib/errors/messages';
import styles from './Account.module.css';

const MESSAGES: Record<string, string> = {
  wrong_password: 'Your password is wrong.',
  rate_limited: MESSAGE_RATE_LIMITED,
};

/** Delete account: type DELETE and your password in a sheet. Nothing is deleted until both are right. */
export function DeleteAccount() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirm: phrase }),
      });
      if (response.ok) {
        queryClient.clear();
        router.replace('/goodbye');
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(MESSAGES[body.error ?? ''] ?? MESSAGE_FALLBACK);
    } catch {
      toast.error(MESSAGE_FALLBACK);
    } finally {
      setPending(false);
    }
  }

  const ready = phrase === DELETE_PHRASE && password !== '';

  return (
    <div>
      <Button variant="destructive" onPress={() => setOpen(true)}>
        Delete account
      </Button>
      <Sheet
        isOpen={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        role="alertdialog"
        isDismissable={false}
      >
        {(close) => (
          <form onSubmit={onSubmit} noValidate className={styles.form} aria-label="Delete account">
            <ul className={styles.list}>
              <li>
                Your profile, photo, settings, gear, recipes, brews and saved recipes are removed.
              </li>
              <li>
                Copies other people made of your public recipes stay with them, credited to
                &ldquo;deleted user&rdquo;.
              </li>
              <li>You&apos;ll be logged out and can&apos;t log in again.</li>
            </ul>
            <TextField
              id="delete-confirm"
              name="confirm"
              label={`Type ${DELETE_PHRASE} to confirm`}
              autoComplete="off"
              value={phrase}
              onChange={setPhrase}
            />
            <PasswordField
              id="delete-password"
              name="password"
              label="Your password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              isInvalid={Boolean(error)}
              errorMessage={error}
            />
            <SheetActions>
              <Button variant="secondary" onPress={close} isDisabled={pending} autoFocus>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                isDisabled={!ready}
                isPending={pending}
                pendingLabel="Deleting…"
              >
                Delete my account
              </Button>
            </SheetActions>
          </form>
        )}
      </Sheet>
    </div>
  );
}
