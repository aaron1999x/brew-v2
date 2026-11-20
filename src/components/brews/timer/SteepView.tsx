'use client';

import { VersionBadge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { Notice } from '@/components/ui/Notice/Notice';
import { missedStepText } from '@/lib/brews/describe';
import { endsWithDrawdown, steepEndsAt, steepRemainingS, steepStepTimes } from '@/lib/brews/timer';
import { useUnits } from '@/lib/settings/useSettings';
import type { RunControl } from './RunRoot';
import styles from './timer.module.css';

/**
 * A long steep (an hour or more): elapsed and remaining time, when each step happens on the clock,
 * and Done. No count-in and no wake lock: leave whenever you like, the Home card keeps track.
 */
export function SteepView({ ctl }: Readonly<{ ctl: RunControl }>) {
  const { weight, duration, time } = useUnits();
  const { session, steps, state, phase, elapsed, now } = ctl;
  const endsAt = steepEndsAt(state);
  const remaining = steepRemainingS(state, now);
  const startedAt = state.startedAt ?? now;
  const schedule = steepStepTimes(state, steps);
  const finishLabel = endsWithDrawdown(session.method) ? 'Drawdown done' : 'Done';

  return (
    <div className={styles.screen}>
      <div className={styles.top}>
        <h1 className={styles.title}>
          {session.recipeName} <VersionBadge version={session.versionNo} />
        </h1>
      </div>

      <div className={styles.clockBlock}>
        <p className={styles.clockLabel}>Steeping for</p>
        <p role="timer" className={`${styles.clock} ${styles.clockLong}`}>
          {duration(Math.max(0, Math.floor(elapsed)))}
        </p>
        {phase === 'finishing' ? (
          <p className={styles.paused}>The steep is done</p>
        ) : (
          <p className={styles.clockLabel}>{duration(Math.ceil(remaining))} to go</p>
        )}
        {endsAt != null ? <p className={styles.clockLabel}>Ends at {time(endsAt)}</p> : null}
      </div>

      <Notice>You can leave this screen. The steep keeps going, and Home shows when it ends.</Notice>

      <section aria-labelledby="steep-steps" className={styles.section}>
        <h2 id="steep-steps" className={styles.sectionTitle}>
          Steps
        </h2>
        <ol className={styles.stepList}>
          {steps.map((step, i) => {
            const at = schedule[i]?.atMs ?? startedAt + step.at_s * 1000;
            const passed = elapsed >= step.at_s;
            return (
              <li key={step.id} className={styles.stepItem}>
                <span className={styles.stepHead}>
                  {missedStepText(step, weight, () => time(at))}
                  {passed ? ' · done' : ''}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className={styles.controls}>
        {phase === 'finishing' ? (
          <Button size="lg" fullWidth onPress={ctl.finish}>
            {finishLabel}
          </Button>
        ) : null}
        <Button size="lg" variant="secondary" fullWidth onPress={ctl.goHome}>
          Back to Home
        </Button>
        <Button size="lg" variant="secondary" fullWidth onPress={ctl.openEnd}>
          End brew
        </Button>
      </div>
    </div>
  );
}
