'use client';

import { Pin, X } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { Icon } from '@/components/ui/Icon/Icon';
import { useUnits } from '@/lib/settings/useSettings';
import styles from './PinnedBrewNote.module.css';

/** What a brew said to change, for the next version's editor. */
export type PinnedBrew = {
  id: string;
  brewedAt: string;
  overall: number;
  /** "Next time I'll change…", or the start of the notes; never empty. */
  text: string;
};

/**
 * "From your brew on 20 Nov: …" pinned at the top of the editor when a next version starts from a
 * brew. It can be dismissed and is never saved into the version.
 */
export function PinnedBrewNote({ brew }: Readonly<{ brew: PinnedBrew }>) {
  const { date } = useUnits();
  const [shown, setShown] = useState(true);
  if (!shown) return null;
  return (
    <aside className={styles.card} aria-label="Note from your brew">
      <Icon icon={Pin} size="md" />
      <div className={styles.text}>
        <p className={styles.title}>
          From your brew on {date(brew.brewedAt)} · overall {brew.overall.toFixed(1)}
        </p>
        <p className={styles.body}>{brew.text}</p>
      </div>
      <IconButton icon={X} label="Dismiss this note" variant="ghost" onPress={() => setShown(false)} />
    </aside>
  );
}
