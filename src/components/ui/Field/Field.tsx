'use client';

import type { ReactNode } from 'react';
import {
  FieldError as AriaFieldError,
  Label,
  Text,
  type FieldErrorProps,
} from 'react-aria-components';
import styles from './Field.module.css';

/** Props every labelled field shares. */
export type FieldChrome = {
  label: ReactNode;
  /** Hint under the field; announced with the field. */
  description?: ReactNode;
  /** Shown only while the field is invalid. A function receives the validation result. */
  errorMessage?: FieldErrorProps['children'];
};

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <Label className={styles.label}>
      {children}
      {/* The input itself carries aria-required, so the marker is decoration. */}
      {required ? (
        <span aria-hidden="true" className={styles.required}>
          {' '}
          *
        </span>
      ) : null}
    </Label>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <Text slot="description" className={styles.hint}>
      {children}
    </Text>
  );
}

export function FieldError({ children }: { children: FieldErrorProps['children'] }) {
  return <AriaFieldError className={styles.error}>{children}</AriaFieldError>;
}

export { styles as fieldStyles };
