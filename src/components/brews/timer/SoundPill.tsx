'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { Icon } from '@/components/ui/Icon/Icon';
import styles from './SoundPill.module.css';

type Props = Readonly<{
  /** The person's Sound setting. */
  on: boolean;
  /** Audio is on in settings but the browser hasn't started it (after a lock or a reload): needs a tap. */
  blocked?: boolean;
  onToggle: () => void;
  onEnable?: () => void;
}>;

/**
 * "Sound on" / "Sound off", the same compact pill in the top bar of the prep and running screens
 * (a toggle button with `aria-pressed`). The pill is small to look at, but the button around it is
 * a full 44 px tall to tap. When sound is on but the browser hasn't started audio, it asks for a tap.
 */
export function SoundPill({ on, blocked = false, onToggle, onEnable }: Props) {
  const needsTap = on && blocked && onEnable != null;
  const label = needsTap ? 'Sound is off: tap to turn on' : on ? 'Sound on' : 'Sound off';
  return (
    <button
      type="button"
      className={styles.button}
      aria-pressed={needsTap ? undefined : on}
      onClick={needsTap ? onEnable : onToggle}
      data-primary-control=""
    >
      <span className={styles.face}>
        <Icon icon={on && !needsTap ? Volume2 : VolumeX} size="sm" />
        <span>{label}</span>
      </span>
    </button>
  );
}
