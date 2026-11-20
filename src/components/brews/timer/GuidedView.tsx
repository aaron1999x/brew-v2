'use client';

import { Thermometer, Volume2, VolumeX } from 'lucide-react';
import { VersionBadge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { Icon } from '@/components/ui/Icon/Icon';
import { Notice } from '@/components/ui/Notice/Notice';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden/VisuallyHidden';
import { stepKindName } from '@/lib/brews/describe';
import { countinLeftS, endsWithDrawdown, nextTempCue, stepPosition } from '@/lib/brews/timer';
import { unlockAudio } from '@/lib/brews/audio';
import { hasPourTemperatures, pourDeltas, stepHeading, type StepData } from '@/lib/recipes/steps';
import { useUnits } from '@/lib/settings/useSettings';
import { WEIGHT_LABEL, formatRate, weightToDisplay } from '@/lib/units';
import { targetRangeText } from '@/lib/brews/targets';
import type { RunControl } from './RunRoot';
import styles from './timer.module.css';

/** The scale weight after the last pour that has started by step `index`. */
function scaleWeightAt(steps: readonly StepData[], index: number): number | null {
  for (let i = index; i >= 0; i--) {
    const s = steps[i]!;
    if (s.kind === 'pour' && s.target_g != null) return s.target_g;
  }
  return null;
}

/**
 * The guided timer (and the stopwatch, when a recipe has no steps): count-in, running clock, the
 * step that is on now and the one coming next, with the controls at the bottom.
 */
export function GuidedView({ ctl }: Readonly<{ ctl: RunControl }>) {
  const { weight, temp, duration, units } = useUnits();
  const { session, steps, applied, phase, elapsed, state, now } = ctl;
  const stopwatch = state.mode === 'stopwatch';
  const position = stepPosition(steps, elapsed);
  const deltas = pourDeltas(steps);
  const switchTo = nextTempCue(steps, elapsed, applied.temp_c);
  const varies = hasPourTemperatures(steps);
  const countLeft = countinLeftS(state, now);
  const showClock = phase !== 'countin';
  const clock = duration(Math.max(0, Math.floor(elapsed)));
  const finishLabel = endsWithDrawdown(session.method) && !stopwatch ? 'Drawdown done' : 'Done';
  const soundOff = ctl.prefs.sound && ctl.audioStatus !== 'running';

  const current = position.currentIndex == null ? null : steps[position.currentIndex]!;
  const next = position.nextIndex == null ? null : steps[position.nextIndex]!;
  const toNext = position.secondsToNext;
  const soon = toNext != null && toNext > 0 && toNext <= 5;
  const first = steps[0];

  const money = (g: number) => {
    const shown = weightToDisplay(g, units.weight_unit);
    return (
      <>
        {shown}
        <span className={styles.unit}> {WEIGHT_LABEL[units.weight_unit]}</span>
      </>
    );
  };

  const targetText =
    applied.drawdown_min_s != null || applied.drawdown_max_s != null
      ? targetRangeText(applied.drawdown_min_s, applied.drawdown_max_s, duration)
      : null;

  return (
    <div className={styles.screen}>
      <div className={styles.top}>
        <h1 className={styles.title}>
          {session.recipeName} <VersionBadge version={session.versionNo} />
        </h1>
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={ctl.prefs.sound}
          onPress={() => {
            ctl.setPrefs({ sound: !ctl.prefs.sound });
            if (!ctl.prefs.sound) void unlockAudio();
          }}
        >
          <Icon icon={ctl.prefs.sound ? Volume2 : VolumeX} size="md" />
          {ctl.prefs.sound ? 'Sound on' : 'Muted'}
        </Button>
      </div>

      {ctl.wake === 'unsupported' || ctl.wake === 'refused' ? (
        <Notice>Your screen may lock during the brew.</Notice>
      ) : null}
      {soundOff && phase !== 'done' ? (
        ctl.audioStatus === 'unavailable' ? (
          <Notice>Sound isn&apos;t available in this browser. The timer still shows every step.</Notice>
        ) : (
          <Button variant="secondary" fullWidth onPress={ctl.enableSound}>
            Sound is off: tap to turn on
          </Button>
        )
      ) : null}

      {/* Count-in: announced once a second. The running clock below is deliberately not a live region. */}
      {phase === 'countin' ? (
        <section className={styles.countin} aria-label="Get ready">
          <p className={styles.clockLabel}>Get ready · brew clock starts in</p>
          <div aria-live="assertive" aria-atomic="true" className={styles.countinNumber}>
            <VisuallyHidden>Starting in </VisuallyHidden>
            {Math.max(1, Math.ceil(countLeft ?? 0))}
          </div>
          <p className={styles.first}>
            {!first
              ? 'Stopwatch'
              : first.kind === 'pour' && first.target_g != null
                ? `${first.technique || 'First pour'} → ${weight(first.target_g)}`
                : `First: ${stepKindName(first)}`}
          </p>
        </section>
      ) : null}

      {showClock ? (
        <div className={styles.clockBlock}>
          <p className={styles.clockLabel}>Brew clock</p>
          <p role="timer" className={styles.clock}>
            {clock}
          </p>
          {phase === 'paused' ? <p className={styles.paused}>Paused</p> : null}
        </div>
      ) : null}

      <div aria-live="polite" className={styles.hiddenLive}>
        {ctl.announcement}
      </div>

      {showClock && !stopwatch ? (
        <>
          {current ? (
            <section className={`${styles.card} ${styles.now}`} aria-label="Current step">
              <p className={styles.cardLabel}>Now</p>
              <p className={styles.cardHeading}>
                {stepHeading(steps, position.currentIndex!).visible}
              </p>
              <ul className={styles.facts}>
                {scaleWeightAt(steps, position.currentIndex!) != null ? (
                  <li>On scale {weight(scaleWeightAt(steps, position.currentIndex!)!)}</li>
                ) : null}
                {current.kind === 'pour' && deltas.get(current.id) != null ? (
                  <li>+{weight(deltas.get(current.id)!)} this pour</li>
                ) : null}
                {current.kind === 'pour' && current.rate_gps != null ? (
                  <li>{formatRate(current.rate_gps, units.weight_unit)}</li>
                ) : null}
                {current.kind === 'pour' && (current.temp_c ?? applied.temp_c) != null ? (
                  <li>{temp((current.temp_c ?? applied.temp_c)!)}</li>
                ) : null}
                {current.kind !== 'pour' && current.duration_s ? (
                  <li>for {duration(current.duration_s)}</li>
                ) : null}
                {current.technique ? <li>{current.technique}</li> : null}
              </ul>
            </section>
          ) : null}

          {next ? (
            <section
              className={`${styles.card} ${styles.next} ${soon ? styles.nextSoon : ''}`}
              aria-label="Next step"
            >
              <p className={styles.cardLabel}>Next</p>
              <p className={styles.cardHeading}>
                {next.kind === 'pour' ? 'Pour' : stepKindName(next)} at {duration(next.at_s)}
                {next.technique ? ` · ${next.technique}` : ''}
              </p>
              {next.kind === 'pour' && next.target_g != null ? (
                <p className={styles.big}>{money(next.target_g)}</p>
              ) : (
                <p className={styles.bigName}>
                  {stepKindName(next)}
                  {next.duration_s ? (
                    <span className={styles.unit}> {duration(next.duration_s)}</span>
                  ) : null}
                </p>
              )}
              {next.kind === 'pour' && deltas.get(next.id) != null ? (
                <p className={styles.hint}>+{weight(deltas.get(next.id)!)} this pour</p>
              ) : null}
              {next.kind === 'pour' && varies ? (
                switchTo != null ? (
                  <p className={`${styles.pill} ${styles.pillSwitch}`}>
                    <Icon icon={Thermometer} size="md" />
                    Switch kettle → {temp(switchTo)}
                  </p>
                ) : (
                  <p className={styles.pill}>{temp((next.temp_c ?? applied.temp_c)!)}</p>
                )
              ) : null}
              <p className={`${styles.countdown} ${soon ? styles.countdownSoon : ''}`}>
                in {toNext! >= 60 ? duration(Math.ceil(toNext!)) : `${Math.max(0, Math.ceil(toNext!))} s`}
              </p>
            </section>
          ) : (
            <section className={`${styles.card} ${styles.next}`} aria-label="All steps done">
              <p className={styles.cardLabel}>Next</p>
              <p className={styles.bigName}>All steps done</p>
              {targetText && !stopwatch ? (
                <p className={styles.hint}>Target drawdown {targetText}</p>
              ) : null}
              <p className={styles.hint}>
                {finishLabel === 'Drawdown done'
                  ? 'Tap Drawdown done when the coffee has finished draining.'
                  : 'Tap Done when the brew is finished.'}
              </p>
            </section>
          )}
        </>
      ) : null}

      <div className={styles.controls}>
        {phase === 'countin' ? (
          <Button size="lg" fullWidth onPress={ctl.skipCountin}>
            Skip · start now
          </Button>
        ) : null}
        {phase === 'running' || phase === 'paused' ? (
          <Button
            size="lg"
            fullWidth
            variant={stopwatch ? 'secondary' : 'primary'}
            onPress={ctl.togglePause}
          >
            {phase === 'paused' ? 'Resume' : 'Pause'}
          </Button>
        ) : null}
        {stopwatch && (phase === 'running' || phase === 'paused') ? (
          <Button size="lg" fullWidth onPress={ctl.finish}>
            Done
          </Button>
        ) : null}
        {phase === 'finishing' ? (
          <Button size="lg" fullWidth onPress={ctl.finish}>
            {finishLabel}
          </Button>
        ) : null}
        <Button size="lg" variant="secondary" fullWidth onPress={ctl.openEnd}>
          End brew
        </Button>
      </div>
    </div>
  );
}
