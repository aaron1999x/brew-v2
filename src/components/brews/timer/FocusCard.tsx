'use client';

import { Thermometer } from 'lucide-react';
import { Icon } from '@/components/ui/Icon/Icon';
import type { FocusInfo } from '@/lib/brews/focus';
import { WEIGHT_LABEL, weightToDisplay, type WeightUnit } from '@/lib/units';
import styles from './timer.module.css';

type Props = Readonly<{
  info: FocusInfo;
  weightUnit: WeightUnit;
  /** After the last step: "Target drawdown 2:45–3:15", when the recipe has one. */
  doneHint?: string | null;
  /** After the last step: what the primary button does ("Tap Drawdown done when…"). */
  doneAction?: string;
  /** Names the card for assistive technology. */
  label?: string;
}>;

/**
 * The one card of the running timer, as in the prototype: where the scale is now, the next step,
 * the next weight as the big number, the "switch kettle" chip and the countdown. After the last
 * step it says so.
 */
export function FocusCard({ info, weightUnit, doneHint, doneAction, label = 'Current step' }: Props) {
  const soon = info.secondsToNext != null && info.secondsToNext > 0 && info.secondsToNext <= 5;
  return (
    <section className={styles.focus} aria-label={label}>
      {info.status ? <p className={styles.status}>{info.status}</p> : null}

      {info.done ? (
        <>
          <p className={styles.doneTitle}>{info.done.title}</p>
          {doneHint ? <p className={styles.nextLine}>{doneHint}</p> : null}
          {doneAction ? <p className={styles.nextLine}>{doneAction}</p> : null}
        </>
      ) : (
        <>
          {info.nextLine ? <p className={styles.nextLine}>{info.nextLine}</p> : null}
          {info.hero?.kind === 'weight' ? (
            <p className={styles.hero}>
              {weightToDisplay(info.hero.grams, weightUnit)}
              <span className={styles.heroUnit}> {WEIGHT_LABEL[weightUnit]}</span>
            </p>
          ) : info.hero ? (
            <p className={styles.heroName}>
              {info.hero.text}
              {info.hero.detail ? <span className={styles.heroUnit}> {info.hero.detail}</span> : null}
            </p>
          ) : null}
          {info.delta ? <p className={styles.delta}>{info.delta}</p> : null}
          {info.kettle ? (
            <p className={`${styles.chip} ${info.kettle.change ? styles.chipSwitch : ''}`}>
              {info.kettle.change ? <Icon icon={Thermometer} size="md" /> : null}
              {info.kettle.text}
            </p>
          ) : null}
          {info.countdown ? (
            <p className={`${styles.countdown} ${soon ? styles.countdownSoon : ''}`}>{info.countdown}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
