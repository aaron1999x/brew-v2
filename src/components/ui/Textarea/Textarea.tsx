'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';
import {
  TextArea,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components';
import { cx } from '@/lib/cx';
import { FieldError, FieldHint, FieldLabel, fieldStyles, type FieldChrome } from '../Field/Field';
import styles from './Textarea.module.css';

export type TextareaProps = Omit<AriaTextFieldProps, 'className' | 'style' | 'children'> &
  FieldChrome & { placeholder?: string; rows?: number };

/** Grows with its content. Uses CSS `field-sizing` where supported and a height fallback otherwise. */
export function Textarea({
  label,
  description,
  errorMessage,
  placeholder,
  rows = 3,
  ...rest
}: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el || (typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content'))) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(resize, [resize, rest.value]);

  return (
    <AriaTextField {...rest} className={fieldStyles.field}>
      <FieldLabel required={rest.isRequired}>{label}</FieldLabel>
      <TextArea
        ref={ref}
        rows={rows}
        placeholder={placeholder}
        onInput={resize}
        className={cx(fieldStyles.control, fieldStyles.input, styles.area)}
      />
      {description ? <FieldHint>{description}</FieldHint> : null}
      <FieldError>{errorMessage}</FieldError>
    </AriaTextField>
  );
}
