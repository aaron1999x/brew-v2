'use client';

import { useState } from 'react';
import {
  Input,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components';
import { cx } from '@/lib/cx';
import { formatDuration, parseDuration } from '@/lib/ui/duration';
import { formatClock } from '@/lib/units/format';
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
    /** An error from the form (e.g. a step that starts too early), shown when the text itself is fine. */
    errorMessage?: string;
    /** Seconds; `null` while empty. */
    value?: number | null;
    onChange?: (seconds: number | null) => void;
    /** Longest allowed time in seconds. Longer times show an error (and are still reported). */
    maxSeconds?: number;
  };

/**
 * Time as m:ss (h:mm:ss from one hour). Accepts `2:30`, `230` (like a microwave), `150s`, `45`
 * and `12:00:00`; stores seconds.
 * While typing it says what it understood; on blur it shows the normalised m:ss.
 */
export function TimeInput({
  label,
  description,
  value,
  onChange,
  onBlur,
  maxSeconds,
  errorMessage,
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

  const tooLong =
    parsed.ok && parsed.seconds != null && maxSeconds != null && parsed.seconds > maxSeconds;
  const rangeError = tooLong ? `Enter a time up to ${formatClock(maxSeconds ?? 0)}` : '';

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
      isInvalid={((!parsed.ok || tooLong) && !editing) || Boolean(errorMessage)}
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
      <FieldError>{(parsed.ok ? rangeError : parsed.error) || errorMessage}</FieldError>
    </AriaTextField>
  );
}
