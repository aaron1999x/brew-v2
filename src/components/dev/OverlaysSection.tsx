'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { Sheet, SheetActions } from '@/components/ui/Sheet/Sheet';
import { toast } from '@/components/ui/Toast/toast';
import { TextField } from '@/components/ui/TextField/TextField';
import styles from './sections.module.css';

type Open = null | 'sheet' | 'long' | 'confirm' | 'destructive';

export function OverlaysSection() {
  const [open, setOpen] = useState<Open>(null);
  const [deleting, setDeleting] = useState(false);
  const [log, setLog] = useState('Nothing yet.');

  const set = (which: Open) => (isOpen: boolean) => setOpen(isOpen ? which : null);

  function confirmDelete() {
    setDeleting(true);
    setTimeout(() => {
      setDeleting(false);
      setOpen(null);
      toast.undo('Brew deleted.', () => setLog('Undo pressed.'));
    }, 1200);
  }

  return (
    <>
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Sheet and dialog</h3>
        <p className={styles.result}>
          One component: a bottom sheet under 768 px wide, a centred dialog above it.
        </p>
        <div className={styles.row}>
          <Button variant="secondary" onPress={() => setOpen('sheet')}>
            Open sheet
          </Button>
          <Button variant="secondary" onPress={() => setOpen('long')}>
            Open long sheet
          </Button>
          <Button variant="secondary" onPress={() => setOpen('confirm')}>
            Confirm
          </Button>
          <Button variant="destructive" onPress={() => setOpen('destructive')}>
            Confirm (destructive)
          </Button>
        </div>
        <p className={styles.result} role="status">
          {log}
        </p>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Toasts</h3>
        <div className={styles.row}>
          <Button variant="secondary" onPress={() => toast.success('Saved as v4.')}>
            Success
          </Button>
          <Button
            variant="secondary"
            onPress={() =>
              toast.error("Couldn't reach the server. Check your connection and try again.", {
                onRetry: () => setLog('Retry pressed.'),
              })
            }
          >
            Error with Retry
          </Button>
          <Button
            variant="secondary"
            onPress={() => toast.error('Something went wrong. Try again.')}
          >
            Error
          </Button>
          <Button
            variant="secondary"
            onPress={() => toast.undo('Recipe archived.', () => setLog('Undo pressed.'))}
          >
            Undo
          </Button>
        </div>
        <p className={styles.result}>
          Toasts stay at least 6 seconds and pause while hovered or focused.
        </p>
      </div>

      <Sheet isOpen={open === 'sheet'} onOpenChange={set('sheet')} title="Share this recipe">
        {(close) => (
          <>
            <p>Anyone with the link can view this recipe once it is public.</p>
            <TextField label="Message" description="Optional." />
            <SheetActions>
              <Button variant="secondary" onPress={close}>
                Cancel
              </Button>
              <Button onPress={close}>Share</Button>
            </SheetActions>
          </>
        )}
      </Sheet>

      <Sheet isOpen={open === 'long'} onOpenChange={set('long')} title="Terms of the long scroll">
        {(close) => (
          <>
            {Array.from({ length: 14 }, (_, i) => (
              <p key={i}>
                Paragraph {i + 1}. This sheet is taller than the screen so its body scrolls while
                the page behind stays still.
              </p>
            ))}
            <SheetActions>
              <Button onPress={close}>Done</Button>
            </SheetActions>
          </>
        )}
      </Sheet>

      <ConfirmDialog
        isOpen={open === 'confirm'}
        onOpenChange={set('confirm')}
        title="Save as v4?"
        message="This version already has brews, so your changes will be saved as a new version."
        confirmLabel="Save as v4"
        onConfirm={() => {
          setOpen(null);
          toast.success('Saved as v4.');
        }}
      />

      <ConfirmDialog
        isOpen={open === 'destructive'}
        onOpenChange={set('destructive')}
        title="Delete this brew?"
        message="You can undo this for a few seconds afterwards."
        confirmLabel="Delete brew"
        tone="destructive"
        isPending={deleting}
        pendingLabel="Deleting…"
        onConfirm={confirmDelete}
      />
    </>
  );
}
