'use client';

import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ActionMenu } from '@/components/ui/ActionMenu/ActionMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { logTimerEvent } from '@/lib/brews/events';
import { brewLogPath, brewTimerPath } from '@/lib/brews/paths';
import type { BrewSession } from '@/lib/brews/schema';
import { sessionStage, type SessionStage } from '@/lib/brews/sessions';
import { steepEndsAt } from '@/lib/brews/timer';
import { discardSession, useBrewSessions } from '@/lib/brews/useBrewSessions';
import { useUnits } from '@/lib/settings/useSettings';
import styles from './UnfinishedSessions.module.css';

/**
 * Every open brew session at the top of Home: finish a log, return to a running timer, check a
 * steep. Each has a menu with Discard (which asks first). Shows nothing when there are none.
 */
export function UnfinishedSessions() {
  const { sessions, ready, userId } = useBrewSessions();
  const { time } = useUnits();
  const [discarding, setDiscarding] = useState<BrewSession | null>(null);

  if (!ready || sessions.length === 0) return null;

  return (
    <section aria-labelledby="unfinished-heading" className={styles.section}>
      <h2 id="unfinished-heading" className={styles.heading}>
        In progress
      </h2>
      <ul className={styles.list}>
        {sessions.map((session) => {
          const stage = sessionStage(session);
          const name = `${session.recipeName} v${session.versionNo}`;
          return (
            <li key={session.id} className={styles.card}>
              <Link
                href={
                  stage === 'logging'
                    ? brewLogPath(session.id)
                    : brewTimerPath(session.handle, session.slug, session.versionNo, session.id)
                }
                className={styles.link}
              >
                <span className={styles.label}>{label(stage, session, time)}</span>
                <span className={styles.name}>{name}</span>
              </Link>
              <ActionMenu
                label={`Actions for ${name}`}
                items={[
                  {
                    id: 'discard',
                    label: 'Discard',
                    icon: Trash2,
                    destructive: true,
                    onAction: () => setDiscarding(session),
                  },
                ]}
              />
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        isOpen={discarding !== null}
        onOpenChange={(open) => {
          if (!open) setDiscarding(null);
        }}
        title="Discard this brew?"
        message="Nothing has been saved yet, so this can't be undone."
        confirmLabel="Discard"
        tone="destructive"
        onConfirm={() => {
          if (!discarding || !userId) return;
          const phase = discarding.timer?.phase;
          if (discarding.entry === 'timer' && phase && phase !== 'prep' && phase !== 'done') {
            logTimerEvent('timer_abandoned', discarding);
          }
          discardSession(userId, discarding.id);
          setDiscarding(null);
        }}
      />
    </section>
  );
}

/** "Finish logging · brewed 8:12", "Steeping · ends 8:15 pm", "Brewing", "Ready to brew". */
function label(stage: SessionStage, session: BrewSession, time: (value: number) => string): string {
  const timer = session.timer;
  switch (stage) {
    case 'logging':
      return `Finish logging · brewed ${time(timer?.startedAt ?? session.createdAt)}`;
    case 'steeping': {
      const ends = timer ? steepEndsAt(timer) : null;
      return ends == null ? 'Steeping' : `Steeping · ends ${time(ends)}`;
    }
    case 'brewing':
      return 'Brewing · back to the timer';
    case 'preparing':
      return 'Ready to brew';
  }
}
