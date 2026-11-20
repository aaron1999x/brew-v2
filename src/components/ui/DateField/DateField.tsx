'use client';

import { parseDate, type CalendarDate } from '@internationalized/date';
import {
  DateField as AriaDateField,
  DateInput,
  DateSegment,
  type DateFieldProps as AriaDateFieldProps,
} from 'react-aria-components';
import { FieldError, FieldHint, FieldLabel, fieldStyles, type FieldChrome } from '../Field/Field';
import styles from './DateField.module.css';

export type DateFieldProps = Omit<
  AriaDateFieldProps<CalendarDate>,
  'className' | 'style' | 'children' | 'value' | 'defaultValue' | 'onChange'
> &
  FieldChrome & {
    /** A calendar date as `YYYY-MM-DD`, or null while empty. */
    value: string | null;
    /** Called with `YYYY-MM-DD` once every part is filled in, and with null when the field is cleared. */
    onChange: (value: string | null) => void;
  };

function toCalendarDate(value: string | null): CalendarDate | null {
  if (!value) return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

/**
 * A date made of day, month and year segments (the order follows the device's locale). It takes and
 * gives a plain `YYYY-MM-DD` string, so the date is never converted through UTC or a time zone.
 */
export function DateField({
  label,
  description,
  errorMessage,
  value,
  onChange,
  ...rest
}: DateFieldProps) {
  return (
    <AriaDateField
      {...rest}
      value={toCalendarDate(value)}
      onChange={(next) => onChange(next ? next.toString() : null)}
      className={fieldStyles.field}
    >
      <FieldLabel required={rest.isRequired}>{label}</FieldLabel>
      <DateInput className={`${fieldStyles.control} ${styles.input}`} data-primary-control="">
        {(segment) => <DateSegment segment={segment} className={styles.segment} />}
      </DateInput>
      {description ? <FieldHint>{description}</FieldHint> : null}
      <FieldError>{errorMessage}</FieldError>
    </AriaDateField>
  );
}
