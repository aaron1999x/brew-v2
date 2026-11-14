'use client';

import { useEffect, useRef } from 'react';
import styles from './FormErrorSummary.module.css';

export type FormError = {
  /** The id of the field's input, so the link can focus it. */
  fieldId: string;
  message: string;
};

type Props = {
  errors: readonly FormError[];
  title?: string;
};

/**
 * Sits at the top of a form after a failed submit. It takes focus (so it is read out), and each
 * entry moves focus to its field. Inline messages under each field stay as well.
 */
export function FormErrorSummary({ errors, title }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // A new set of errors means a new failed submit: focus the summary again.
  const signature = errors.map((e) => `${e.fieldId}:${e.message}`).join('|');

  useEffect(() => {
    if (signature) ref.current?.focus();
  }, [signature]);

  if (errors.length === 0) return null;

  const heading =
    title ??
    (errors.length === 1 ? 'Fix 1 thing to continue' : `Fix ${errors.length} things to continue`);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      className={styles.summary}
      aria-labelledby="form-error-summary-title"
    >
      <h2 id="form-error-summary-title" className={styles.title}>
        {heading}
      </h2>
      <ul className={styles.list}>
        {errors.map((e) => (
          <li key={e.fieldId}>
            <a
              href={`#${e.fieldId}`}
              className={styles.link}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(e.fieldId)?.focus();
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
