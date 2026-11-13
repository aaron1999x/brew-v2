'use client';

import {
  Input,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components';
import { cx } from '@/lib/cx';
import { FieldError, FieldHint, FieldLabel, fieldStyles, type FieldChrome } from '../Field/Field';

export type TextFieldProps = Omit<AriaTextFieldProps, 'className' | 'style' | 'children'> &
  FieldChrome & { placeholder?: string };

export function TextField({
  label,
  description,
  errorMessage,
  placeholder,
  ...rest
}: TextFieldProps) {
  return (
    <AriaTextField {...rest} className={fieldStyles.field}>
      <FieldLabel required={rest.isRequired}>{label}</FieldLabel>
      <Input
        placeholder={placeholder}
        className={cx(fieldStyles.control, fieldStyles.input)}
        data-primary-control=""
      />
      {description ? <FieldHint>{description}</FieldHint> : null}
      <FieldError>{errorMessage}</FieldError>
    </AriaTextField>
  );
}
