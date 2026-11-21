'use client';

import { VersionBadge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { stepKindName } from '@/lib/brews/describe';
import { focusInfo } from '@/lib/brews/focus';
import {
  endsWithDrawdown,
  steepEndsAt,
  steepRemainingS,
  steepStepTimes,
} from '@/lib/brews/timer';
import { useUnits } from '@/lib/settings/useSettings';
import { FocusCard } from './FocusCard';
import { FlipClock } from './FlipClock';
import type { RunControl } from './RunRoot';
import { SoundPill } from './SoundPill';
import { TimerProgress } from './TimerProgress';
import styles from './timer.module.css';

/**
 * A long steep (an hour or more), laid out like the guided timer: the clock with its progress bar,
 * one card with the next step and when it happens on the wall clock, and the controls. No count-in
 * and no wake lock: leave whenever you like, the Home card keeps track. The steps sit below as
 * chips with their clock times.
 */
export function SteepView({ ctl }: Readonly<{ ctl: RunControl }>) {
  const { weight, temp, duration, time, units } = useUnits();
  const { session, steps, applied, state, phase, elapsed, now } = ctl;
  const endsAt = steepEndsAt(state);
  const remaining = steepRemainingS(state, now);
  const startedAt = state.startedAt ?? now;
  const schedule = steepStepTimes(state, steps);
  const finishLabel = endsWithDrawdown(session.method) ? 'Drawdown done' : 'Done';
  const wallClock = (stepSeconds: number) => time(startedAt + stepSeconds * 1000);
  const audioBlocked = ctl.audioStatus !== 'running' && ctl.audioStatus !== 'unavailable';

  const info = focusInfo(steps, elapsed, applied.temp_c, { weight, temp, duration, at: wallClock });

  return (
    <div className={styles.screen}>
      <div className={styles.top}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>
            <span className={styles.titleText}>{session.recipeName}</span>
            <VersionBadge version={session.versionNo} />
          </h1>
        </div>
        {ctl.audioStatus === 'unavailable' ? null : (
          <SoundPill
            on={ctl.prefs.sound}
            blocked={audioBlocked}
            onToggle={ctl.toggleSound}
            onEnable={ctl.enableSound}
          />
        )}
      </div>

      <div className={`${styles.clockBlock} ${styles.clockBlockSteep}`}>
        <p className={styles.clockLabel}>Steeping for</p>
        <span className={styles.clockSizeLong}>
          <FlipClock seconds={elapsed} label="Steeping for" />
        </span>
        {state.endS != null ? <TimerProgress elapsedS={elapsed} totalS={state.endS} /> : null}
        <p className={styles.clockLabel}>
          {phase === 'finishing'
            ? 'The steep is done'
            : `${duration(Math.ceil(remaining))} to go${endsAt != null ? ` · ends at ${time(endsAt)}` : ''}`}
        </p>
      </div>

      <FocusCard
        info={info}
        weightUnit={units.weight_unit}
        doneAction={
          finishLabel === 'Drawdown done'
            ? 'Tap Drawdown done when the coffee has finished draining.'
            : 'Tap Done when the brew is finished.'
        }
      />

      <section aria-labelledby="steep-steps" className={styles.steepList} tabIndex={0}>
        <h2 id="steep-steps" className={styles.sectionTitle}>
          Steps
        </h2>
        <ol className={styles.chips}>
          {steps.map((step, i) => {
            const at = schedule[i]?.atMs ?? startedAt + step.at_s * 1000;
            const passed = elapsed >= step.at_s;
            const pour = step.kind === 'pour' && step.target_g != null;
            return (
              <li
                key={step.id}
                className={`${styles.stepChip} ${pour ? '' : styles.stepChipOther} ${passed ? styles.stepChipDone : ''}`}
              >
                <span className={styles.stepTime}>{time(at)}</span>
                <span className={styles.stepMain}>
                  {pour ? weight(step.target_g as number) : stepKindName(step)}
                </span>
                {passed ? <span className={styles.stepSub}>done</span> : null}
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
        ) : (
          <Button size="lg" fullWidth onPress={ctl.goHome}>
            Back to Home
          </Button>
        )}
        <Button size="lg" variant="ghost" fullWidth onPress={ctl.openEnd}>
          End brew
        </Button>
      </div>
    </div>
  );
}
