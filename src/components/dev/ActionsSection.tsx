'use client';

import { Bell, Plus, Share2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/Button/Button';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { Icon } from '@/components/ui/Icon/Icon';
import styles from './sections.module.css';

const variants: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'destructive'];
const sizes: ButtonSize[] = ['sm', 'md', 'lg'];

export function ActionsSection() {
  const [saving, setSaving] = useState(false);
  const [presses, setPresses] = useState(0);

  function fakeSave() {
    setSaving(true);
    setTimeout(() => setSaving(false), 2000);
  }

  return (
    <>
      {variants.map((variant) => (
        <div key={variant} className={styles.group}>
          <h3 className={styles.groupTitle}>Button · {variant}</h3>
          <div className={styles.row}>
            {sizes.map((size) => (
              <Button
                key={size}
                variant={variant}
                size={size}
                onPress={() => setPresses((n) => n + 1)}
              >
                {size.toUpperCase()} default
              </Button>
            ))}
            <Button variant={variant} isDisabled>
              Disabled
            </Button>
            <Button variant={variant} isPending pendingLabel="Saving…">
              Save
            </Button>
          </div>
        </div>
      ))}

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Loading demo</h3>
        <div className={styles.row}>
          <Button isPending={saving} pendingLabel="Saving…" onPress={fakeSave}>
            Save recipe
          </Button>
          <span className={styles.result}>
            Presses so far: {presses}. Press Save: width stays, double presses are ignored.
          </span>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Button · with icon and full width</h3>
        <div className={styles.row}>
          <Button variant="secondary">
            <Icon icon={Plus} />
            New recipe
          </Button>
        </div>
        <Button fullWidth size="lg">
          Start brewing
        </Button>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>IconButton</h3>
        <div className={styles.row}>
          <IconButton icon={Bell} label="Notices" />
          <IconButton icon={Share2} label="Share" variant="secondary" />
          <IconButton icon={Plus} label="Add" variant="primary" />
          <IconButton icon={Trash2} label="Delete" size="sm" />
          <IconButton icon={Bell} label="Notices (disabled)" isDisabled />
        </div>
      </div>
    </>
  );
}
