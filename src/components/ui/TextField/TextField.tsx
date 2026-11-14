'use client';

import {
  Input,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components';
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
      <div className={fieldStyles.control} data-primary-control="">
        <Input placeholder={placeholder} className={fieldStyles.input} />
      </div>
      {description ? <FieldHint>{description}</FieldHint> : null}
      <FieldError>{errorMessage}</FieldError>
    </AriaTextField>
  );
}
