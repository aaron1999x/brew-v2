'use client';

import { useState } from 'react';
import { cx } from '@/lib/cx';
import { useReducedMotion } from '@/lib/ui/useReducedMotion';
import { formatClock } from '@/lib/units';
import styles from './FlipClock.module.css';

export type FlipTone = 'ink' | 'accent';

/**
 * One split-flap card, ported from the prototype (components/FlipClock.tsx). When `value` changes the
 * old top half folds down, revealing the new top, then the new bottom half swings down over the old
 * bottom, like a Solari board. Size follows font-size (everything is in em). Under reduced motion
 * the digits just change. Purely visual: the clock around it carries the accessible name.
 */
export function FlipCard({ value, tone = 'ink' }: Readonly<{ value: string; tone?: FlipTone }>) {
  const reduce = useReducedMotion();
  // The previous value is tracked while rendering (not in an effect), so the new bottom half never
  // flashes for a frame before the flip starts.
  const [state, setState] = useState({ value, from: value, id: 0 });
  if (state.value !== value) setState({ value, from: state.value, id: state.id + 1 });
  const flipping = !reduce && state.from !== state.value;
  const done = () => setState((s) => (s.id === state.id ? { ...s, from: s.value } : s));

  return (
    <span className={cx(styles.flip, tone === 'accent' && styles.accent)} aria-hidden="true">
      <span className={styles.sizer}>{value}</span>
      <span className={cx(styles.half, styles.top)}>
        <span>{state.value}</span>
      </span>
      <span className={cx(styles.half, styles.bottom)}>
        <span>{flipping ? state.from : state.value}</span>
      </span>
      {flipping ? (
        <>
          <span key={`t${state.id}`} className={cx(styles.half, styles.top, styles.flap, styles.foldTop)}>
            <span>{state.from}</span>
          </span>
          <span
            key={`b${state.id}`}
            className={cx(styles.half, styles.bottom, styles.flap, styles.unfoldBottom)}
            onAnimationEnd={done}
          >
            <span>{state.value}</span>
          </span>
        </>
      ) : null}
    </span>
  );
}

type ClockProps = Readonly<{
  /** Whole seconds to show: m:ss, or h:mm:ss from an hour. */
  seconds: number;
  tone?: FlipTone;
  /** Names the clock for assistive technology, e.g. "Brew clock". The time itself is read from the label. */
  label?: string;
}>;

/**
 * A clock made of flip cards: "0:45" is two cards, "1:02:03" is three. A timer to assistive
 * technology (its label is the time; it is not a live region, so it never interrupts).
 */
export function FlipClock({ seconds, tone = 'ink', label }: ClockProps) {
  const text = formatClock(Math.max(0, Math.floor(seconds)));
  const parts = text.split(':');
  return (
    <span
      role="timer"
      aria-label={label ? `${label} ${text}` : text}
      data-time={text}
      className={styles.clock}
    >
      {parts.map((part, i) => (
        <span key={i} className={styles.part} aria-hidden="true">
          {i > 0 ? <span className={styles.sep}>:</span> : null}
          <FlipCard value={part} tone={tone} />
        </span>
      ))}
    </span>
  );
}

/** A single big card: the count-in number. */
export function FlipNumber({ value, tone = 'accent' }: Readonly<{ value: number; tone?: FlipTone }>) {
  return <FlipCard value={String(value)} tone={tone} />;
}
