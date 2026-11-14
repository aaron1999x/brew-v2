'use client';

import {
  Radio,
  RadioGroup as AriaRadioGroup,
  type RadioGroupProps as AriaRadioGroupProps,
} from 'react-aria-components';
import { FieldError, FieldHint, FieldLabel, fieldStyles, type FieldChrome } from '../Field/Field';
import styles from './RadioGroup.module.css';

export type RadioOption = { value: string; label: string; isDisabled?: boolean };

export type RadioGroupProps = Omit<AriaRadioGroupProps, 'className' | 'style' | 'children'> &
  FieldChrome & { options: readonly RadioOption[] };

export function RadioGroup({
  label,
  description,
  errorMessage,
  options,
  ...rest
}: RadioGroupProps) {
  return (
    <AriaRadioGroup {...rest} className={fieldStyles.field}>
      <FieldLabel required={rest.isRequired}>{label}</FieldLabel>
      <div className={styles.options}>
        {options.map((o) => (
          <Radio
            key={o.value}
            value={o.value}
            isDisabled={o.isDisabled}
            className={styles.radio}
            data-primary-control=""
          >
            <span className={styles.dot} aria-hidden="true" />
            <span>{o.label}</span>
          </Radio>
        ))}
      </div>
      {description ? <FieldHint>{description}</FieldHint> : null}
      <FieldError>{errorMessage}</FieldError>
    </AriaRadioGroup>
  );
}
