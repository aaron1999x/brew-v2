'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { VersionBadge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { Icon } from '@/components/ui/Icon/Icon';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden/VisuallyHidden';
import { stepKindName } from '@/lib/brews/describe';
import { focusInfo } from '@/lib/brews/focus';
import { targetRangeText } from '@/lib/brews/targets';
import { countinLeftS, endsWithDrawdown } from '@/lib/brews/timer';
import { hasPourTemperatures } from '@/lib/recipes/steps';
import { useUnits } from '@/lib/settings/useSettings';
import { FocusCard } from './FocusCard';
import { FlipClock, FlipNumber } from './FlipClock';
import type { RunControl } from './RunRoot';
import styles from './timer.module.css';

/**
 * The guided timer (and the stopwatch, when a recipe has no steps), laid out like the prototype's:
 * the brew clock large at the top, ONE card for what's on now and what's next, the controls at the
 * bottom. Sized with dvh and clamp() so all of it fits the visible screen with no scrolling.
 */
export function GuidedView({ ctl }: Readonly<{ ctl: RunControl }>) {
  const { weight, temp, duration, units } = useUnits();
  const { session, steps, applied, phase, elapsed, state, now } = ctl;
  const stopwatch = state.mode === 'stopwatch';
  const varies = hasPourTemperatures(steps);
  const countLeft = countinLeftS(state, now);
  const drawdown = endsWithDrawdown(session.method) && !stopwatch;
  const finishLabel = drawdown ? 'Drawdown done' : 'Done';
  const soundOff = ctl.prefs.sound && ctl.audioStatus !== 'running' && ctl.audioStatus !== 'unavailable';
  const first = steps[0];

  const info = focusInfo(steps, elapsed, applied.temp_c, { weight, temp, duration, at: duration });
  const drawdownTarget =
    applied.drawdown_min_s != null || applied.drawdown_max_s != null
      ? targetRangeText(applied.drawdown_min_s, applied.drawdown_max_s, duration)
      : null;

  const firstLine = !first
    ? 'Stopwatch'
    : first.kind === 'pour' && first.target_g != null
      ? `${first.technique || 'First pour'} → ${weight(first.target_g)}${
          varies && (first.temp_c ?? applied.temp_c) != null
            ? ` · ${temp((first.temp_c ?? applied.temp_c)!)}`
            : ''
        }`
      : `First: ${stepKindName(first)}`;

  return (
    <div className={styles.screen}>
      <div className={styles.top}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>
            <span className={styles.titleText}>{session.recipeName}</span>
            <VersionBadge version={session.versionNo} />
          </h1>
          {ctl.wake === 'unsupported' || ctl.wake === 'refused' ? (
            <p className={styles.caption}>Your screen may lock during the brew.</p>
          ) : null}
          {ctl.prefs.sound && ctl.audioStatus === 'unavailable' ? (
            <p className={styles.caption}>Sound isn&apos;t available in this browser.</p>
          ) : null}
        </div>
        {ctl.audioStatus === 'unavailable' ? null : (
          <span className={styles.soundButton}>
            <Button
              variant="secondary"
              aria-pressed={soundOff ? undefined : ctl.prefs.sound}
              onPress={soundOff ? ctl.enableSound : ctl.toggleSound}
            >
              <Icon icon={ctl.prefs.sound && !soundOff ? Volume2 : VolumeX} size="md" />
              {soundOff ? 'Sound is off: tap to turn on' : ctl.prefs.sound ? 'Sound on' : 'Muted'}
            </Button>
          </span>
        )}
      </div>

      {phase === 'countin' ? (
        <section className={styles.countin} aria-label="Get ready">
          <p className={styles.clockLabel}>Get ready · brew clock starts in</p>
          <div aria-live="assertive" aria-atomic="true">
            <VisuallyHidden>{`Starting in ${Math.max(1, Math.ceil(countLeft ?? 0))}`}</VisuallyHidden>
            <span className={styles.countinNumber}>
              <FlipNumber value={Math.max(1, Math.ceil(countLeft ?? 0))} />
            </span>
          </div>
          <p className={styles.first}>{firstLine}</p>
        </section>
      ) : (
        <>
          <div className={styles.clockBlock}>
            <span className={styles.clockSize}>
              <FlipClock seconds={elapsed} label="Brew clock" />
            </span>
            {phase === 'paused' ? <p className={styles.paused}>Paused</p> : null}
          </div>

          <div aria-live="polite" className={styles.hiddenLive}>
            {ctl.announcement}
          </div>

          {stopwatch ? (
            <section className={styles.focus} aria-label="Stopwatch">
              <p className={styles.status}>Stopwatch</p>
              <p className={styles.nextLine}>This recipe has no steps. Tap Done when the brew is finished.</p>
            </section>
          ) : (
            <FocusCard
              info={info}
              weightUnit={units.weight_unit}
              doneHint={drawdownTarget ? `Target drawdown ${drawdownTarget}` : null}
              doneAction={
                drawdown
                  ? 'Tap Drawdown done when the coffee has finished draining.'
                  : 'Tap Done when the brew is finished.'
              }
            />
          )}
        </>
      )}

      {phase === 'countin' ? (
        <div className={styles.controls}>
          <Button size="lg" fullWidth onPress={ctl.skipCountin}>
            Skip · start now
          </Button>
          <Button size="lg" variant="secondary" fullWidth onPress={ctl.openEnd}>
            End brew
          </Button>
        </div>
      ) : null}

      {stopwatch && (phase === 'running' || phase === 'paused') ? (
        <div className={`${styles.controls} ${styles.controlsStack}`}>
          <Button size="lg" fullWidth onPress={ctl.finish}>
            Done
          </Button>
          <Button size="lg" variant="secondary" fullWidth onPress={ctl.togglePause}>
            {phase === 'paused' ? 'Resume' : 'Pause'}
          </Button>
          <Button size="lg" variant="secondary" fullWidth onPress={ctl.openEnd}>
            End brew
          </Button>
        </div>
      ) : null}

      {!stopwatch && (phase === 'running' || phase === 'paused') ? (
        <div className={styles.controls}>
          <Button size="lg" fullWidth onPress={ctl.togglePause}>
            {phase === 'paused' ? 'Resume' : 'Pause'}
          </Button>
          <Button size="lg" variant="secondary" fullWidth onPress={ctl.openEnd}>
            End brew
          </Button>
        </div>
      ) : null}

      {phase === 'finishing' ? (
        <div className={styles.controls}>
          <Button size="lg" fullWidth onPress={ctl.finish}>
            {finishLabel}
          </Button>
          <Button size="lg" variant="secondary" fullWidth onPress={ctl.openEnd}>
            End brew
          </Button>
        </div>
      ) : null}
    </div>
  );
}
