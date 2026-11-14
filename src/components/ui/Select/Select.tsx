'use client';

import { ChevronDown, Check } from 'lucide-react';
import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select as AriaSelect,
  SelectValue,
  type SelectProps as AriaSelectProps,
} from 'react-aria-components';
import { cx } from '@/lib/cx';
import { FieldError, FieldHint, FieldLabel, fieldStyles, type FieldChrome } from '../Field/Field';
import { Icon } from '../Icon/Icon';
import styles from './Select.module.css';

export type SelectOption = { id: string; label: string; isDisabled?: boolean };

export type SelectProps = Omit<
  AriaSelectProps<SelectOption>,
  'className' | 'style' | 'children' | 'placeholder'
> &
  FieldChrome & {
    options: readonly SelectOption[];
    placeholder?: string;
  };

/** A popover list of options. The popover matches the trigger's width and never leaves the viewport. */
export function Select({
  label,
  description,
  errorMessage,
  options,
  placeholder = 'Select…',
  ...rest
}: SelectProps) {
  return (
    <AriaSelect {...rest} placeholder={placeholder} className={fieldStyles.field}>
      <FieldLabel required={rest.isRequired}>{label}</FieldLabel>
      <Button className={cx(fieldStyles.control, styles.trigger)} data-primary-control="">
        <SelectValue className={styles.value} />
        <Icon icon={ChevronDown} size="md" />
      </Button>
      {description ? <FieldHint>{description}</FieldHint> : null}
      <FieldError>{errorMessage}</FieldError>
      <Popover className={styles.popover} offset={4}>
        <ListBox className={styles.list} items={options}>
          {(item) => (
            <ListBoxItem
              id={item.id}
              textValue={item.label}
              isDisabled={item.isDisabled}
              className={styles.item}
            >
              {({ isSelected }) => (
                <>
                  <span className={styles.itemLabel}>{item.label}</span>
                  {isSelected ? <Icon icon={Check} size="md" /> : null}
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
