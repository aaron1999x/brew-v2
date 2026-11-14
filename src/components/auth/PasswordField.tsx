'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/Checkbox/Checkbox';
import { TextField, type TextFieldProps } from '@/components/ui/TextField/TextField';
import styles from './PasswordField.module.css';

type Props = Omit<TextFieldProps, 'type'> & {
  /** `new-password` when choosing one, `current-password` when entering one. */
  autoComplete: 'new-password' | 'current-password';
};

/** A password input with a "Show password" toggle (a checkbox: clear label, works by keyboard). */
export function PasswordField({ autoComplete, ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.wrap}>
      <TextField {...rest} type={visible ? 'text' : 'password'} autoComplete={autoComplete} />
      <Checkbox isSelected={visible} onChange={setVisible}>
        Show password
      </Checkbox>
    </div>
  );
}
