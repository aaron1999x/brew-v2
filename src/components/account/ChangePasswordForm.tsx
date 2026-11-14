'use client';

import { useState, type FormEvent } from 'react';
import { PasswordField } from '@/components/auth/PasswordField';
import { Button } from '@/components/ui/Button/Button';
import {
  FormErrorSummary,
  type FormError,
} from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { toast } from '@/components/ui/Toast/toast';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/constants';
import { AUTH_ERROR_MESSAGES, toUserMessage } from '@/lib/errors/messages';
import { reportUnexpected } from '@/lib/errors/report';
import { createClient } from '@/lib/supabase/client';
import styles from './Account.module.css';

const ID = { current: 'current-password', next: 'new-password' };
const WRONG_CURRENT = 'Your current password is wrong.';

const CURRENT_PASSWORD_CODES = new Set([
  'current_password_invalid',
  'current_password_required',
  'current_password_mismatch',
  'invalid_credentials',
  'reauthentication_not_valid',
]);

/** Which field a failed change belongs to, from the Supabase Auth `error.code`. */
export function passwordErrorField(code: string | undefined): 'current' | 'next' | null {
  if (code && CURRENT_PASSWORD_CODES.has(code)) return 'current';
  if (code === 'same_password' || code === 'weak_password') return 'next';
  return null;
}

export function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<FormError[]>([]);
  const [pending, setPending] = useState(false);
  const fieldError = (id: string) => errors.find((e) => e.fieldId === id)?.message;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: FormError[] = [];
    if (current === '') {
      found.push({ fieldId: ID.current, message: 'Enter your current password.' });
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      found.push({
        fieldId: ID.next,
        message: `Choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
    }
    setErrors(found);
    if (found.length > 0) return;

    setPending(true);
    const { error } = await createClient().auth.updateUser({
      password: next,
      current_password: current,
    });
    setPending(false);

    if (!error) {
      setCurrent('');
      setNext('');
      toast.success('Password changed.');
      return;
    }
    const field = passwordErrorField(error.code);
    if (field === 'current') {
      setErrors([{ fieldId: ID.current, message: WRONG_CURRENT }]);
    } else if (field === 'next') {
      const message = AUTH_ERROR_MESSAGES[error.code ?? ''] ?? toUserMessage(error);
      setErrors([{ fieldId: ID.next, message }]);
    } else {
      reportUnexpected(error);
      toast.error(toUserMessage(error), { onRetry: () => void onSubmit(event) });
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className={styles.form} aria-label="Change password">
      <FormErrorSummary errors={errors} />
      <PasswordField
        id={ID.current}
        name="current-password"
        label="Current password"
        autoComplete="current-password"
        value={current}
        onChange={setCurrent}
        isRequired
        isInvalid={Boolean(fieldError(ID.current))}
        errorMessage={fieldError(ID.current)}
      />
      <PasswordField
        id={ID.next}
        name="new-password"
        label="New password"
        autoComplete="new-password"
        value={next}
        onChange={setNext}
        isRequired
        description={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        isInvalid={Boolean(fieldError(ID.next))}
        errorMessage={fieldError(ID.next)}
      />
      <Button type="submit" isPending={pending} pendingLabel="Changing…">
        Change password
      </Button>
    </form>
  );
}
