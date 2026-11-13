'use client';

import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Checkbox as AriaCheckbox,
  type CheckboxProps as AriaCheckboxProps,
} from 'react-aria-components';
import { Icon } from '../Icon/Icon';
import styles from './Checkbox.module.css';

export type CheckboxProps = Omit<AriaCheckboxProps, 'className' | 'style' | 'children'> & {
  children: ReactNode;
};

export function Checkbox({ children, ...rest }: CheckboxProps) {
  return (
    <AriaCheckbox {...rest} className={styles.checkbox} data-primary-control="">
      {({ isSelected, isIndeterminate }) => (
        <>
          <span className={styles.box} aria-hidden="true">
            {isIndeterminate ? (
              <Icon icon={Minus} size="sm" />
            ) : isSelected ? (
              <Icon icon={Check} size="sm" />
            ) : null}
          </span>
          <span>{children}</span>
        </>
      )}
    </AriaCheckbox>
  );
}
