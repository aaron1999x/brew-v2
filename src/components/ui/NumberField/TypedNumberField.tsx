'use client';

import { useState } from 'react';
import { numberToText, parseTypedNumber } from '@/lib/ui/typedNumber';
import { TextField } from '../TextField/TextField';

type Props = Readonly<{
  id?: string;
  label: string;
  description?: string;
  placeholder?: string;
  /** The stored number, or null while empty (or while the text isn't a number). */
  value: number | null;
  /** Text that isn't a number, kept as typed so the form can say what is wrong with it. */
  typed?: string;
  /**
   * Called as the text changes: a number, null when empty, or null with the unreadable text.
   * A number is reported as typed (7.5 in a whole-number field too); the form's rules decide whether
   * it is allowed, and say so when saving.
   */
  onChange: (value: number | null, typed?: string) => void;
  /** The form's message for this field (shown after Save), through the error summary too. */
  error?: string;
}>;

/**
 * A number field that never refuses a keystroke. The text stays exactly as typed (a decimal comma
 * works), and anything that isn't allowed is explained with a message when the form is saved,
 * rather than the field silently ignoring a key. It shows the decimal keypad so a point can be typed
 * even where only whole numbers are valid: the message then says "Use whole microns".
 */
export function TypedNumberField({ id, label, description, placeholder, value, typed, onChange, error }: Props) {
  const initial = typed ?? numberToText(value);
  const [text, setText] = useState(initial);

  // Follow outside changes (a restored draft, a reset) but never fight what is being typed.
  const [seen, setSeen] = useState({ value, typed });
  if (seen.value !== value || seen.typed !== typed) {
    setSeen({ value, typed });
    const parsed = parseTypedNumber(text);
    const matches =
      typed !== undefined
        ? text === typed
        : parsed.kind === 'empty'
          ? value == null
          : parsed.kind === 'number' && parsed.value === value;
    if (!matches) setText(initial);
  }

  return (
    <TextField
      id={id}
      label={label}
      description={description}
      placeholder={placeholder}
      value={text}
      onChange={(next) => {
        setText(next);
        const parsed = parseTypedNumber(next);
        if (parsed.kind === 'empty') onChange(null);
        else if (parsed.kind === 'number') onChange(parsed.value);
        else onChange(null, next);
      }}
      isInvalid={Boolean(error)}
      errorMessage={error}
      inputProps={{
        inputMode: 'decimal',
        autoComplete: 'off',
        autoCorrect: 'off',
        autoCapitalize: 'none',
        spellCheck: false,
      }}
    />
  );
}
