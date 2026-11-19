'use client';

import { Ellipsis, type LucideIcon } from 'lucide-react';
import { Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { cx } from '@/lib/cx';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import styles from './ActionMenu.module.css';

export type ActionMenuItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Red text: for an action that removes something. */
  destructive?: boolean;
  onAction: () => void;
};

type Props = Readonly<{
  /** Names the button: "Actions for Morning V60". */
  label: string;
  items: readonly ActionMenuItem[];
}>;

/**
 * A "more actions" button that opens a short list. Arrow keys move, Enter or Space chooses, Escape
 * closes and returns focus to the button. Every item is a full-size target.
 */
export function ActionMenu({ label, items }: Props) {
  return (
    <MenuTrigger>
      <IconButton icon={Ellipsis} label={label} />
      <Popover className={styles.popover} placement="bottom end" offset={4}>
        <Menu aria-label={label} className={styles.menu} onAction={(key) => items.find((i) => i.id === key)?.onAction()}>
          {items.map((item) => (
            <MenuItem
              key={item.id}
              id={item.id}
              textValue={item.label}
              className={cx(styles.item, item.destructive && styles.destructive)}
            >
              {item.icon ? <Icon icon={item.icon} size="md" /> : null}
              <span>{item.label}</span>
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
