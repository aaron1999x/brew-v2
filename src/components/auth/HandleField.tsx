'use client';

import { Button } from '@/components/ui/Button/Button';
import { TextField } from '@/components/ui/TextField/TextField';
import { HANDLE_MESSAGES, useHandleSuggestions, type HandleStatus } from '@/lib/auth/handle';
import styles from './HandleField.module.css';

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** From `useHandleStatus(value)` in the parent, which also needs it to decide on submit. */
  status: HandleStatus | null;
  isChecking: boolean;
  /** An error from elsewhere (for example a failed save) shown when the live check is fine. */
  errorMessage?: string;
  label?: string;
  /** Text to base suggestions on when the handle is taken (defaults to the typed handle). */
  suggestionBase?: string;
};

/** Handle input with the live availability check and up to 3 free suggestions. */
export function HandleField({
  id,
  value,
  onChange,
  status,
  isChecking,
  errorMessage,
  label = 'Handle',
  suggestionBase,
}: Props) {
  const unavailable = status === 'taken' || status === 'reserved';
  const suggestions = useHandleSuggestions(suggestionBase || value, unavailable);
  const liveError = status && status !== 'ok' ? HANDLE_MESSAGES[status] : undefined;
  const message = liveError ?? errorMessage;

  let description = 'Lowercase letters, numbers and underscores, 3–30 characters.';
  if (isChecking) description = 'Checking…';
  else if (status === 'ok') description = 'Available.';

  return (
    <div className={styles.wrap}>
      <TextField
        id={id}
        name="handle"
        label={label}
        value={value}
        onChange={(next) => onChange(next.toLowerCase())}
        autoComplete="username"
        spellCheck="false"
        isRequired
        isInvalid={Boolean(message)}
        errorMessage={message}
        description={message ? undefined : description}
      />
      {unavailable && suggestions.data && suggestions.data.length > 0 ? (
        <div className={styles.suggestions} role="group" aria-label="Free handles you could use">
          <span className={styles.hint}>Try one of these:</span>
          <ul className={styles.list}>
            {suggestions.data.map((handle) => (
              <li key={handle}>
                <Button variant="secondary" onPress={() => onChange(handle)}>
                  {handle}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
