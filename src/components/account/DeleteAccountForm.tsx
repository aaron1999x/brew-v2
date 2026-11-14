'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { PasswordField } from '@/components/auth/PasswordField';
import { Button } from '@/components/ui/Button/Button';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import {
  FormErrorSummary,
  type FormError,
} from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { TextField } from '@/components/ui/TextField/TextField';
import { toast } from '@/components/ui/Toast/toast';
import { DELETE_PHRASE, isDeletePhrase } from '@/lib/account/deleteAccount';
import { MESSAGE_FALLBACK, MESSAGE_RATE_LIMITED } from '@/lib/errors/messages';
import styles from './Account.module.css';

const ID = { confirm: 'delete-confirm', password: 'delete-password' };

const SERVER_MESSAGES: Record<string, string> = {
  wrong_password: 'Your password is wrong.',
  rate_limited: MESSAGE_RATE_LIMITED,
};

/**
 * The delete-account form, on its own page so a phone's keyboard can't cover it. The button is
 * always enabled; problems are reported on submit in the error summary, next to each field.
 */
export function DeleteAccountForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FormError[]>([]);
  const fieldError = (id: string) => errors.find((e) => e.fieldId === id)?.message;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: FormError[] = [];
    if (!isDeletePhrase(phrase)) {
      found.push({ fieldId: ID.confirm, message: `Type ${DELETE_PHRASE} to confirm.` });
    }
    if (password === '') {
      found.push({ fieldId: ID.password, message: 'Enter your password.' });
    }
    setErrors(found);
    if (found.length > 0) return;

    setPending(true);
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirm: phrase.trim() }),
      });
      if (response.ok) {
        queryClient.clear();
        router.replace('/goodbye');
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      const message = SERVER_MESSAGES[body.error ?? ''] ?? MESSAGE_FALLBACK;
      setErrors([{ fieldId: ID.password, message }]);
    } catch {
      toast.error(MESSAGE_FALLBACK);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className={styles.form} aria-label="Delete account">
      <FormErrorSummary errors={errors} />
      <ul className={styles.list}>
        <li>Your profile, photo, settings, gear, recipes, brews and saved recipes are removed.</li>
        <li>
          Copies other people made of your public recipes stay with them, credited to &ldquo;deleted
          user&rdquo;.
        </li>
        <li>You&apos;ll be logged out and can&apos;t log in again.</li>
      </ul>
      <TextField
        id={ID.confirm}
        name="confirm"
        label={`Type ${DELETE_PHRASE} to confirm`}
        autoComplete="off"
        inputProps={{ autoCapitalize: 'characters', autoCorrect: 'off', spellCheck: false }}
        value={phrase}
        onChange={setPhrase}
        isInvalid={Boolean(fieldError(ID.confirm))}
        errorMessage={fieldError(ID.confirm)}
      />
      <PasswordField
        id={ID.password}
        name="password"
        label="Your password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        isInvalid={Boolean(fieldError(ID.password))}
        errorMessage={fieldError(ID.password)}
      />
      <div className={styles.buttons}>
        <Button
          type="submit"
          variant="destructive"
          size="lg"
          isPending={pending}
          pendingLabel="Deleting…"
        >
          Delete my account
        </Button>
        <ButtonLink href="/settings/account" variant="secondary" size="lg">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
