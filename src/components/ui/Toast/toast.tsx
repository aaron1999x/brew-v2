'use client';

import { CircleAlert, CircleCheck, Undo2, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast as sonner } from 'sonner';
import { cx } from '@/lib/cx';
import { Icon } from '../Icon/Icon';
import styles from './Toast.module.css';

type Tone = 'success' | 'error' | 'undo';

const tones: Record<Tone, { icon: LucideIcon; title: string; duration: number }> = {
  success: { icon: CircleCheck, title: 'Success', duration: 6000 },
  error: { icon: CircleAlert, title: 'Error', duration: 10000 },
  undo: { icon: Undo2, title: 'Done', duration: 8000 },
};

type CardProps = {
  id: string | number;
  tone: Tone;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Dismisses itself after `ms`, but not while the pointer is over it or focus is inside it, so a
 * keyboard or screen-reader user is never raced. Sonner's own timer is turned off (duration: Infinity).
 */
function useAutoDismiss(id: string | number, ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => sonner.dismiss(id), ms);
    };
    const stop = () => clearTimeout(timer.current);
    const resumeIfIdle = () => {
      if (!el.matches(':hover') && !el.contains(document.activeElement)) start();
    };
    start();
    el.addEventListener('pointerenter', stop);
    el.addEventListener('focusin', stop);
    el.addEventListener('pointerleave', resumeIfIdle);
    const afterFocusOut = () => setTimeout(resumeIfIdle, 0);
    el.addEventListener('focusout', afterFocusOut);
    return () => {
      clearTimeout(timer.current);
      el.removeEventListener('pointerenter', stop);
      el.removeEventListener('focusin', stop);
      el.removeEventListener('pointerleave', resumeIfIdle);
      el.removeEventListener('focusout', afterFocusOut);
    };
  }, [id, ms]);

  return ref;
}

function ToastCard({ id, tone, message, actionLabel, onAction }: CardProps) {
  const { icon, title, duration } = tones[tone];
  const ref = useAutoDismiss(id, duration);
  const isError = tone === 'error';

  return (
    <div
      ref={ref}
      // Errors interrupt (role="alert" = assertive); the rest wait their turn (role="status" = polite).
      role={isError ? 'alert' : 'status'}
      className={cx(styles.toast, styles[tone])}
    >
      <Icon icon={icon} size="md" />
      <p className={styles.message}>
        <span className={styles.srTitle}>{title}: </span>
        {message}
      </p>
      {actionLabel && onAction ? (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            sonner.dismiss(id);
            onAction();
          }}
          data-primary-control=""
        >
          {actionLabel}
        </button>
      ) : null}
      <button
        type="button"
        className={styles.close}
        aria-label="Dismiss notification"
        onClick={() => sonner.dismiss(id)}
      >
        <Icon icon={X} size="sm" />
      </button>
    </div>
  );
}

function show(props: Omit<CardProps, 'id'>) {
  return sonner.custom((id) => <ToastCard id={id} {...props} />, { duration: Infinity });
}

/** App-wide toasts. Success is polite, errors are announced at once, undo offers a way back. */
export const toast = {
  success: (message: string) => show({ tone: 'success', message }),
  error: (message: string, options?: { onRetry?: () => void }) =>
    show({
      tone: 'error',
      message,
      actionLabel: options?.onRetry ? 'Retry' : undefined,
      onAction: options?.onRetry,
    }),
  undo: (message: string, onUndo: () => void) =>
    show({ tone: 'undo', message, actionLabel: 'Undo', onAction: onUndo }),
  dismiss: (id?: string | number) => sonner.dismiss(id),
};
