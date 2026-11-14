'use client';

import { useState, type FormEvent } from 'react';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { TextField } from '@/components/ui/TextField/TextField';
import { toast } from '@/components/ui/Toast/toast';
import { inviteMessage, useAddInvite, useInvites, useRemoveInvite } from '@/lib/admin/useInvites';
import { isPlausibleEmail } from '@/lib/auth/client';
import { toUserMessage } from '@/lib/errors/messages';
import { useUnits } from '@/lib/settings/useSettings';
import styles from './Invites.module.css';

const EMAIL_ID = 'invite-email';

/** /admin/invites: add an email, see who is invited or signed up, remove unused invites, copy the message. */
export function InvitesManager() {
  const invites = useInvites();
  const add = useAddInvite();
  const remove = useRemoveInvite();
  const units = useUnits();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!isPlausibleEmail(value)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(undefined);
    try {
      await add.mutateAsync(value);
      setEmail('');
      toast.success('Invite added.');
    } catch (e) {
      setError(toUserMessage(e));
    }
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(inviteMessage(window.location.origin));
      toast.success('Invite message copied.');
    } catch {
      toast.error("Couldn't copy. Select the text and copy it yourself.");
    }
  }

  return (
    <div className={styles.page}>
      <form onSubmit={onSubmit} noValidate className={styles.form} aria-label="Add an invite">
        <TextField
          id={EMAIL_ID}
          name="invite-email"
          type="email"
          label="Email to invite"
          autoComplete="off"
          value={email}
          onChange={setEmail}
          isInvalid={Boolean(error)}
          errorMessage={error}
        />
        <Button type="submit" isPending={add.isPending} pendingLabel="Adding…">
          Add invite
        </Button>
      </form>

      <div>
        <Button variant="secondary" onPress={copyMessage}>
          Copy invite message
        </Button>
        <p className={styles.note}>Paste it into a message. The app doesn&apos;t send email.</p>
      </div>

      <section aria-labelledby="invites-title">
        <h2 id="invites-title" className={styles.heading}>
          Invites
        </h2>
        <QueryBoundary
          label="invites"
          isLoading={invites.isPending}
          isError={invites.isError}
          onRetry={() => void invites.refetch()}
        >
          {invites.data && invites.data.length === 0 ? (
            <p className={styles.note}>No invites yet.</p>
          ) : (
            <ul className={styles.list}>
              {invites.data?.map((invite) => (
                <li key={invite.email} className={styles.row}>
                  <div className={styles.rowText}>
                    <span className={styles.email}>{invite.email}</span>
                    <span className={styles.meta}>
                      {invite.signed_up_at
                        ? `Signed up ${units.date(invite.signed_up_at)}`
                        : `Invited ${units.date(invite.invited_at)}`}
                    </span>
                  </div>
                  <Badge tone={invite.signed_up_at ? 'success' : 'neutral'}>
                    {invite.signed_up_at ? 'Signed up' : 'Invited'}
                  </Badge>
                  {invite.signed_up_at ? null : (
                    <Button
                      variant="ghost"
                      isDisabled={remove.isPending}
                      onPress={() => remove.mutate(invite.email)}
                      aria-label={`Remove invite for ${invite.email}`}
                    >
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </section>
    </div>
  );
}
