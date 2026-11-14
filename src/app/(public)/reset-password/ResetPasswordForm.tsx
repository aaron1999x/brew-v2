'use client';

import { useActionState, useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/auth/AuthCard';
import { ExpiredLink } from '@/components/auth/ExpiredLink';
import { PasswordField } from '@/components/auth/PasswordField';
import styles from '@/components/auth/AuthForm.module.css';
import { Button } from '@/components/ui/Button/Button';
import {
  FormErrorSummary,
  type FormError,
} from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/constants';
import { resetPasswordAction, type ResetState } from './actions';

const ID = 'reset-password';

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    resetPasswordAction,
    undefined,
  );
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormError[]>([]);

  if (state?.expired) return <ExpiredLink recovery />;

  // Check length before posting, so the summary takes focus; the server checks again.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      event.preventDefault();
      setErrors([
        {
          fieldId: ID,
          message: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`,
        },
      ]);
      return;
    }
    setErrors([]);
  }

  const serverError = state?.error && errors.length === 0 ? state.error : undefined;
  const summary: FormError[] = serverError ? [{ fieldId: ID, message: serverError }] : errors;

  return (
    <AuthCard title="Choose a new password" description="Use at least 8 characters.">
      <form
        action={action}
        onSubmit={onSubmit}
        noValidate
        className={styles.form}
        aria-label="Password reset"
      >
        <FormErrorSummary errors={summary} />
        <PasswordField
          id={ID}
          name="password"
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          isRequired
          isInvalid={summary.length > 0}
          errorMessage={summary[0]?.message}
        />
        <Button type="submit" size="lg" fullWidth isPending={pending} pendingLabel="Saving…">
          Save password
        </Button>
      </form>
    </AuthCard>
  );
}
