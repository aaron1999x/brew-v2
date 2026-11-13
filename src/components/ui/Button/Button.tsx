'use client';

import type { ReactNode } from 'react';
import {
  Button as AriaButton,
  ProgressBar,
  type ButtonProps as AriaButtonProps,
} from 'react-aria-components';
import { cx } from '@/lib/cx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<AriaButtonProps, 'className' | 'style' | 'children'> & {
  variant?: ButtonVariant;
  /** `sm` is 32 px tall and only for secondary actions; `md` and `lg` are primary controls (≥ 44 px). */
  size?: ButtonSize;
  /** Shows a spinner and `pendingLabel`, keeps the width, and ignores presses. */
  isPending?: boolean;
  /** The verb while pending, e.g. "Saving…". */
  pendingLabel?: string;
  /** Stretches to the container's width. */
  fullWidth?: boolean;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  isPending = false,
  pendingLabel = 'Working…',
  fullWidth = false,
  children,
  ...rest
}: ButtonProps) {
  return (
    <AriaButton
      {...rest}
      isPending={isPending}
      className={cx(styles.button, styles[variant], styles[size], fullWidth && styles.full)}
      data-primary-control={size === 'sm' ? undefined : ''}
    >
      {/* Both layers always occupy the same cell, so the width never changes while pending. */}
      <span className={styles.content}>{children}</span>
      <span className={styles.pending}>
        {isPending ? (
          <ProgressBar aria-label={pendingLabel} isIndeterminate className={styles.spinner} />
        ) : (
          // Same size as the spinner, so the button is exactly as wide before and while pending.
          <span aria-hidden="true" className={styles.spinner} />
        )}
        <span aria-hidden={!isPending}>{pendingLabel}</span>
      </span>
    </AriaButton>
  );
}
