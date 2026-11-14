'use client';

import { useState } from 'react';
import {
  Input,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components';
import { cx } from '@/lib/cx';
import { formatDuration, parseDuration } from '@/lib/ui/duration';
import { FieldError, FieldHint, FieldLabel, fieldStyles, type FieldChrome } from '../Field/Field';

export type TimeInputProps = Omit<
  AriaTextFieldProps,
  | 'className'
  | 'style'
  | 'children'
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'inputMode'
  | 'isInvalid'
> &
  Omit<FieldChrome, 'errorMessage'> & {
    /** Seconds; `null` while empty. */
    value?: number | null;
    onChange?: (seconds: number | null) => void;
  };

/**
 * Time as m:ss. Accepts `2:30`, `230` (like a microwave), `150s` and `45`; stores seconds.
 * While typing it says what it understood; on blur it shows the normalised m:ss.
 */
export function TimeInput({
  label,
  description,
  value,
  onChange,
  onBlur,
  ...rest
}: TimeInputProps) {
  const [text, setText] = useState(value == null ? '' : formatDuration(value));
  const [editing, setEditing] = useState(false);
  const parsed = parseDuration(text);

  // Follow outside changes (e.g. a form reset) but never fight what the user is typing.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (!editing) setText(value == null ? '' : formatDuration(value));
  }

  const understood = parsed.ok && parsed.seconds != null ? formatDuration(parsed.seconds) : null;
  const hint =
    editing && understood && understood !== text.trim()
      ? `Understood as ${understood}`
      : description;

  return (
    <AriaTextField
      {...rest}
      value={text}
      inputMode="numeric"
      // Partial input like "2:" isn't an error while typing; it is once the field loses focus.
      isInvalid={!parsed.ok && !editing}
      onChange={(next) => {
        setText(next);
        setEditing(true);
        const result = parseDuration(next);
        if (result.ok) onChange?.(result.seconds);
      }}
      onBlur={(event) => {
        setEditing(false);
        if (parsed.ok && parsed.seconds != null) setText(formatDuration(parsed.seconds));
        onBlur?.(event);
      }}
      className={fieldStyles.field}
    >
      <FieldLabel required={rest.isRequired}>{label}</FieldLabel>
      <div className={fieldStyles.control} data-primary-control="">
        <Input placeholder="m:ss" autoComplete="off" className={cx(fieldStyles.input, 'num')} />
      </div>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <FieldError>{parsed.ok ? '' : parsed.error}</FieldError>
    </AriaTextField>
  );
}
