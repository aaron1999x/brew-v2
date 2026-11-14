'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { PasswordField } from '@/components/auth/PasswordField';
import styles from '@/components/auth/AuthForm.module.css';
import { Button } from '@/components/ui/Button/Button';
import {
  FormErrorSummary,
  type FormError,
} from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { TextField } from '@/components/ui/TextField/TextField';
import { toast } from '@/components/ui/Toast/toast';
import { currentConfirmUrl, isPlausibleEmail } from '@/lib/auth/client';
import { toUserMessage } from '@/lib/errors/messages';
import { reportUnexpected } from '@/lib/errors/report';
import { createClient } from '@/lib/supabase/client';

const ID = { email: 'login-email', password: 'login-password' };

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const submitting = useRef(false);

  const fieldError = (fieldId: string) => errors.find((e) => e.fieldId === fieldId)?.message;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setFormError(null);
    setUnconfirmed(false);

    const found: FormError[] = [];
    if (!isPlausibleEmail(email))
      found.push({ fieldId: ID.email, message: 'Enter your email address.' });
    if (password.length === 0)
      found.push({ fieldId: ID.password, message: 'Enter your password.' });
    setErrors(found);
    if (found.length > 0) return;

    submitting.current = true;
    setPending(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        setFormError(toUserMessage(error));
        setUnconfirmed(error.code === 'email_not_confirmed');
        reportUnexpected(error, { where: 'login' });
        return;
      }
      router.replace(next ?? '/home');
      router.refresh();
    } catch (error) {
      setFormError(toUserMessage(error));
      toast.error(toUserMessage(error), { onRetry: () => void onSubmit(event) });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      const { error } = await createClient().auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: currentConfirmUrl() },
      });
      if (error) {
        toast.error(toUserMessage(error), { onRetry: () => void resend() });
        reportUnexpected(error, { where: 'resend-login' });
        return;
      }
      toast.success('Email sent. Check your inbox.');
    } catch (error) {
      toast.error(toUserMessage(error), { onRetry: () => void resend() });
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className={styles.form} aria-label="Log in">
      <FormErrorSummary errors={errors} />
      {formError ? (
        <p role="alert" className={styles.formError}>
          {formError}
        </p>
      ) : null}
      {unconfirmed ? (
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          isPending={resending}
          pendingLabel="Sending…"
          onPress={resend}
        >
          Resend email
        </Button>
      ) : null}
      <TextField
        id={ID.email}
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={setEmail}
        isRequired
        isInvalid={Boolean(fieldError(ID.email))}
        errorMessage={fieldError(ID.email)}
      />
      <PasswordField
        id={ID.password}
        name="password"
        label="Password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        isRequired
        isInvalid={Boolean(fieldError(ID.password))}
        errorMessage={fieldError(ID.password)}
      />
      <Button type="submit" size="lg" fullWidth isPending={pending} pendingLabel="Logging in…">
        Log in
      </Button>
    </form>
  );
}
