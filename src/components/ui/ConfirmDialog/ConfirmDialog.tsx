'use client';

import type { ReactNode } from 'react';
import { Button } from '../Button/Button';
import { Sheet, SheetActions } from '../Sheet/Sheet';
import styles from './ConfirmDialog.module.css';

export type ConfirmDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive: red confirm button, the backdrop does NOT close it, focus starts on Cancel. */
  tone?: 'normal' | 'destructive';
  isPending?: boolean;
  pendingLabel?: string;
  onConfirm: () => void;
};

/**
 * Escape and Cancel always back out safely. Backdrop taps back out too, except for destructive
 * confirmations, where an accidental tap outside shouldn't decide anything.
 */
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'normal',
  isPending = false,
  pendingLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const destructive = tone === 'destructive';
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      role="alertdialog"
      isDismissable={!destructive}
      hideCloseButton
    >
      {(close) => (
        <>
          <p className={styles.message}>{message}</p>
          <SheetActions>
            <Button
              variant="secondary"
              onPress={close}
              autoFocus={destructive}
              isDisabled={isPending}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? 'destructive' : 'primary'}
              isPending={isPending}
              pendingLabel={pendingLabel}
              onPress={onConfirm}
            >
              {confirmLabel}
            </Button>
          </SheetActions>
        </>
      )}
    </Sheet>
  );
}
