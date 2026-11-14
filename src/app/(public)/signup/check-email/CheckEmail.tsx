'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AuthCard } from '@/components/auth/AuthCard';
import styles from '@/components/auth/AuthForm.module.css';
import { Button } from '@/components/ui/Button/Button';
import { toast } from '@/components/ui/Toast/toast';
import {
  clearPendingSignup,
  cooldownRemaining,
  currentConfirmUrl,
  parsePendingSignup,
  readPendingSignupRaw,
  savePendingSignup,
  type PendingSignup,
} from '@/lib/auth/client';
import { toUserMessage } from '@/lib/errors/messages';
import { reportUnexpected } from '@/lib/errors/report';
import { createClient } from '@/lib/supabase/client';

/** "Check your email": shows the address, a Resend button with a 60 s cooldown, and a way back. */
export function CheckEmail() {
  // sessionStorage isn't available while rendering on the server: read it as an external store.
  const raw = useSyncExternalStore(
    () => () => {},
    readPendingSignupRaw,
    () => null,
  );
  const stored = useMemo(() => parsePendingSignup(raw), [raw]);
  const [resent, setResent] = useState<PendingSignup | null>(null);
  const pending = resent ?? stored;
  const [now, setNow] = useState(() => Date.now());
  const remaining = pending ? cooldownRemaining(pending.sentAt, now) : 0;
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  async function resend() {
    if (!pending || sending || remaining > 0) return;
    setSending(true);
    try {
      const { error } = await createClient().auth.resend({
        type: 'signup',
        email: pending.email,
        options: { emailRedirectTo: currentConfirmUrl() },
      });
      if (error) {
        toast.error(toUserMessage(error), { onRetry: () => void resend() });
        reportUnexpected(error, { where: 'resend-signup' });
        return;
      }
      const next = { email: pending.email, sentAt: Date.now() };
      savePendingSignup(next);
      setResent(next);
      setNow(Date.now());
      setSent(true);
      toast.success('Email sent again.');
    } catch (error) {
      toast.error(toUserMessage(error), { onRetry: () => void resend() });
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthCard
      title="Check your email"
      description={
        pending ? (
          <>
            We sent a confirmation link to <strong>{pending.email}</strong>. Open it on any device
            to finish signing up.
          </>
        ) : (
          'We sent you a confirmation link. Open it on any device to finish signing up.'
        )
      }
      footer={
        <p>
          <Link href="/signup" onClick={clearPendingSignup}>
            Use a different email
          </Link>
        </p>
      }
    >
      <div className={styles.actions}>
        {sent ? (
          <p role="status" className={styles.message}>
            We sent it again. It can take a minute to arrive.
          </p>
        ) : null}
        {pending ? (
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            isDisabled={remaining > 0}
            isPending={sending}
            pendingLabel="Sending…"
            onPress={resend}
          >
            {remaining > 0 ? `Resend email in ${remaining} s` : 'Resend email'}
          </Button>
        ) : null}
        <p>Can&apos;t find it? Check your spam folder.</p>
      </div>
    </AuthCard>
  );
}
