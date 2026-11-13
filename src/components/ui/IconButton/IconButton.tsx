'use client';

import type { LucideIcon } from 'lucide-react';
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import { cx } from '@/lib/cx';
import { Icon } from '../Icon/Icon';
import styles from './IconButton.module.css';

export type IconButtonProps = Omit<
  AriaButtonProps,
  'className' | 'style' | 'children' | 'aria-label'
> & {
  icon: LucideIcon;
  /** Required: an icon alone has no name. */
  label: string;
  variant?: 'ghost' | 'secondary' | 'primary';
  /** `md` is 44 px (primary control); `sm` is 32 px for dense toolbars. */
  size?: 'sm' | 'md';
};

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  ...rest
}: IconButtonProps) {
  return (
    <AriaButton
      {...rest}
      aria-label={label}
      className={cx(styles.button, styles[variant], styles[size])}
      data-primary-control={size === 'md' ? '' : undefined}
    >
      <Icon icon={icon} size="md" />
    </AriaButton>
  );
}
