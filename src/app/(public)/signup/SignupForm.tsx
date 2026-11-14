'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { HandleField } from '@/components/auth/HandleField';
import { PasswordField } from '@/components/auth/PasswordField';
import { Button } from '@/components/ui/Button/Button';
import {
  FormErrorSummary,
  type FormError,
} from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { TextField } from '@/components/ui/TextField/TextField';
import { toast } from '@/components/ui/Toast/toast';
import {
  currentConfirmUrl,
  isPlausibleEmail,
  isSignupDatabaseError,
  MIN_PASSWORD_LENGTH,
  savePendingSignup,
} from '@/lib/auth/client';
import { isValidHandleFormat, useHandleStatus } from '@/lib/auth/handle';
import { ERROR_MESSAGES, MESSAGE_FALLBACK, toUserMessage } from '@/lib/errors/messages';
import { reportUnexpected } from '@/lib/errors/report';
import { createClient } from '@/lib/supabase/client';
import styles from '@/components/auth/AuthForm.module.css';

type Props = {
  /** A safe relative path to open after confirming (from `?return_to=`), or null. */
  returnTo: string | null;
};

const ID = {
  email: 'signup-email',
  password: 'signup-password',
  name: 'signup-name',
  handle: 'signup-handle',
};

/** Sign-up (F1): checks the invite list first, then creates the account and sends the email. */
export function SignupForm({ returnTo }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [errors, setErrors] = useState<FormError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const handleStatus = useHandleStatus(handle);

  const fieldError = (fieldId: string) => errors.find((e) => e.fieldId === fieldId)?.message;

  function validate(): FormError[] {
    const found: FormError[] = [];
    if (!isPlausibleEmail(email))
      found.push({ fieldId: ID.email, message: 'Enter a valid email address.' });
    if (password.length < MIN_PASSWORD_LENGTH)
      found.push({
        fieldId: ID.password,
        message: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`,
      });
    const name = displayName.trim();
    if (name.length < 1 || name.length > 60)
      found.push({ fieldId: ID.name, message: 'Enter a display name (up to 60 characters).' });
    if (!isValidHandleFormat(handle))
      found.push({
        fieldId: ID.handle,
        message: 'Use 3–30 lowercase letters, numbers or underscores for your handle.',
      });
    else if (handleStatus.status && handleStatus.status !== 'ok')
      found.push({ fieldId: ID.handle, message: 'Choose a handle that is available.' });
    return found;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setFormError(null);
    const found = validate();
    setErrors(found);
    if (found.length > 0) return;

    submitting.current = true;
    setPending(true);
    try {
      const supabase = createClient();
      const address = email.trim().toLowerCase();

      // 1. Friendly invite check. No account is created for someone who isn't invited.
      const allowed = await supabase.rpc('can_sign_up', { p_email: address });
      if (allowed.error) {
        setFormError(toUserMessage(allowed.error));
        return;
      }
      if (!allowed.data) {
        setFormError(ERROR_MESSAGES.invite_only);
        return;
      }

      // 2. Create the account. The database trigger enforces the invite list again.
      const { error } = await supabase.auth.signUp({
        email: address,
        password,
        options: {
          emailRedirectTo: currentConfirmUrl(),
          data: {
            handle,
            display_name: displayName.trim(),
            time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            ...(returnTo ? { return_to: returnTo } : {}),
          },
        },
      });

      if (error) {
        if (isSignupDatabaseError(error)) {
          // Supabase hides trigger errors. Don't guess "invite-only": ask again.
          const again = await supabase.rpc('can_sign_up', { p_email: address });
          if (again.data === false) {
            setFormError(ERROR_MESSAGES.invite_only);
          } else {
            setFormError(MESSAGE_FALLBACK);
            reportUnexpected(error, { where: 'signup', step: 'database-error' }, true);
          }
        } else {
          setFormError(toUserMessage(error));
          reportUnexpected(error, { where: 'signup' });
        }
        return;
      }

      savePendingSignup({ email: address, sentAt: Date.now() });
      router.push('/signup/check-email');
    } catch (error) {
      setFormError(toUserMessage(error));
      toast.error(toUserMessage(error), { onRetry: () => void onSubmit(event) });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className={styles.form} aria-label="Sign up">
      <FormErrorSummary errors={errors} />
      {formError ? (
        <p role="alert" className={styles.formError}>
          {formError}
        </p>
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
        autoComplete="new-password"
        description={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        value={password}
        onChange={setPassword}
        isRequired
        isInvalid={Boolean(fieldError(ID.password))}
        errorMessage={fieldError(ID.password)}
      />
      <TextField
        id={ID.name}
        name="display_name"
        label="Display name"
        autoComplete="name"
        value={displayName}
        onChange={setDisplayName}
        isRequired
        isInvalid={Boolean(fieldError(ID.name))}
        errorMessage={fieldError(ID.name)}
      />
      <HandleField
        id={ID.handle}
        value={handle}
        onChange={setHandle}
        status={handleStatus.status}
        isChecking={handleStatus.isChecking}
        errorMessage={fieldError(ID.handle)}
        suggestionBase={handle || displayName}
      />
      <Button
        type="submit"
        size="lg"
        fullWidth
        isPending={pending}
        pendingLabel="Creating account…"
      >
        Create account
      </Button>
    </form>
  );
}
