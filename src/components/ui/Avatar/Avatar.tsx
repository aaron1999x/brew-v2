'use client';

import { useState } from 'react';
import { cx } from '@/lib/cx';
import styles from './Avatar.module.css';

type Props = {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  /** Set when the name is shown next to it, so screen readers don't hear it twice. */
  decorative?: boolean;
};

/** "Aaron Tan" → "AT"; "aaron" → "A"; handles extra spaces and symbols. */
export function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]!;
  const last = words.length > 1 ? words[words.length - 1]! : '';
  return (Array.from(first)[0]! + (last ? Array.from(last)[0]! : '')).toUpperCase();
}

export function Avatar({ name, src, size = 'md', decorative = false }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  const label = name.trim() || 'Unknown user';
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label };

  return (
    <span className={cx(styles.avatar, styles[size])} {...a11y}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- user photos come from Supabase Storage; sizes are fixed by CSS
        <img src={src!} alt="" className={styles.image} onError={() => setFailed(true)} />
      ) : (
        <span className={styles.initials} aria-hidden="true">
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}
