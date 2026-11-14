'use client';

import { useRef, useState, type FormEvent } from 'react';
import styles from '@/components/auth/AuthForm.module.css';
import { Button } from '@/components/ui/Button/Button';
import {
  FormErrorSummary,
  type FormError,
} from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { TextField } from '@/components/ui/TextField/TextField';
import { toast } from '@/components/ui/Toast/toast';
import { currentConfirmUrl, isPlausibleEmail } from '@/lib/auth/client';
import { MESSAGE_RATE_LIMITED, toUserMessage } from '@/lib/errors/messages';
import { reportUnexpected } from '@/lib/errors/report';
import { createClient } from '@/lib/supabase/client';

const EMAIL_ID = 'forgot-email';
const NEUTRAL = "If an account exists for that email, we've sent a link.";

/** Always answers with the same sentence, so it can't be used to find out who has an account. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FormError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setFormError(null);
    setDone(false);
    if (!isPlausibleEmail(email)) {
      setErrors([{ fieldId: EMAIL_ID, message: 'Enter your email address.' }]);
      return;
    }
    setErrors([]);

    submitting.current = true;
    setPending(true);
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: currentConfirmUrl() },
      );
      if (error) {
        const message = toUserMessage(error);
        // Rate limits and network problems are shown (the user can act on them). Anything else
        // gets the neutral sentence and goes to Sentry.
        if (message === MESSAGE_RATE_LIMITED || error.status === 0) {
          setFormError(message);
          return;
        }
        reportUnexpected(error, { where: 'forgot-password' });
      }
      setDone(true);
    } catch (error) {
      setFormError(toUserMessage(error));
      toast.error(toUserMessage(error), { onRetry: () => void onSubmit(event) });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className={styles.form} aria-label="Reset password">
      <FormErrorSummary errors={errors} />
      {formError ? (
        <p role="alert" className={styles.formError}>
          {formError}
        </p>
      ) : null}
      {done ? (
        <p role="status" className={styles.message}>
          {NEUTRAL}
        </p>
      ) : null}
      <TextField
        id={EMAIL_ID}
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={setEmail}
        isRequired
        isInvalid={errors.length > 0}
        errorMessage={errors[0]?.message}
      />
      <Button type="submit" size="lg" fullWidth isPending={pending} pendingLabel="Sending…">
        Send link
      </Button>
    </form>
  );
}
