'use client';

import type { ReactNode } from 'react';
import { Switch as AriaSwitch, type SwitchProps as AriaSwitchProps } from 'react-aria-components';
import styles from './Switch.module.css';

export type SwitchProps = Omit<AriaSwitchProps, 'className' | 'style' | 'children'> & {
  children: ReactNode;
};

export function Switch({ children, ...rest }: SwitchProps) {
  return (
    <AriaSwitch {...rest} className={styles.switch} data-primary-control="">
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      <span>{children}</span>
    </AriaSwitch>
  );
}
