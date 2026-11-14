'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { cx } from '@/lib/cx';
import { useVisualViewport } from '@/lib/ui/useVisualViewport';
import { IconButton } from '../IconButton/IconButton';
import styles from './Sheet.module.css';

export type SheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  /** Receives `close` so footers can dismiss the sheet. */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Tapping the backdrop closes it. Turn off for decisions that must be answered. */
  isDismissable?: boolean;
  /** `alertdialog` for confirmations that interrupt the user. */
  role?: 'dialog' | 'alertdialog';
  /** Hide the corner close button (confirmations have explicit buttons). */
  hideCloseButton?: boolean;
};

/**
 * One overlay that adapts: a bottom sheet on phones, a centred dialog from 768 px up.
 * React Aria moves focus in, keeps it inside, returns it to the opener, locks page scroll and
 * closes on Escape. Enter/exit animation uses [data-entering]/[data-exiting] and is off under
 * reduced motion.
 */
export function Sheet({
  isOpen,
  onOpenChange,
  title,
  children,
  isDismissable = true,
  role = 'dialog',
  hideCloseButton = false,
}: SheetProps) {
  // Track the visible area only while open: the on-screen keyboard must not cover the sheet.
  const viewport = useVisualViewport(isOpen);
  const bodyRef = useRef<HTMLDivElement>(null);

  // When the keyboard opens or closes, keep the focused field in view inside the scrolling sheet.
  useEffect(() => {
    const active = document.activeElement;
    if (viewport && active instanceof HTMLElement && bodyRef.current?.contains(active)) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [viewport]);

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      className={styles.overlay}
      style={
        viewport ? { top: viewport.offsetTop, bottom: 'auto', height: viewport.height } : undefined
      }
    >
      <Modal className={styles.modal}>
        <Dialog role={role} className={styles.dialog}>
          {({ close }) => (
            <>
              <div className={styles.header}>
                <Heading slot="title" className={styles.title}>
                  {title}
                </Heading>
                {hideCloseButton ? null : (
                  <IconButton slot="close" icon={X} label="Close" variant="ghost" />
                )}
              </div>
              <div
                className={cx(styles.body)}
                ref={bodyRef}
                onFocus={(event) => {
                  // Let the keyboard finish opening, then bring the field into view.
                  const field = event.target;
                  setTimeout(() => field.scrollIntoView({ block: 'nearest' }), 300);
                }}
              >
                {typeof children === 'function' ? children(close) : children}
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Footer row for a sheet's actions. */
export function SheetActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
