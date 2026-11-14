'use client';

import { ChevronDown, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Button,
  ComboBox as AriaComboBox,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
  type ComboBoxProps as AriaComboBoxProps,
  type Key,
} from 'react-aria-components';
import { cx } from '@/lib/cx';
import { filterItems, hasExactMatch } from '@/lib/ui/filter';
import { FieldError, FieldHint, FieldLabel, fieldStyles, type FieldChrome } from '../Field/Field';
import { Icon } from '../Icon/Icon';
import styles from './Combobox.module.css';

export type ComboboxItem = { id: string; label: string };

export type ComboboxSelection =
  { kind: 'item'; item: ComboboxItem } | { kind: 'custom'; text: string } | { kind: 'cleared' };

const CUSTOM_ID = '__custom__';
const LOADING_ID = '__loading__';

export type ComboboxProps = Omit<
  AriaComboBoxProps<ComboboxItem>,
  | 'className'
  | 'style'
  | 'children'
  | 'items'
  | 'defaultItems'
  | 'inputValue'
  | 'defaultInputValue'
  | 'onInputChange'
  | 'selectedKey'
  | 'defaultSelectedKey'
  | 'onSelectionChange'
  | 'allowsCustomValue'
> &
  FieldChrome & {
    items: readonly ComboboxItem[];
    placeholder?: string;
    /** Offer a visible "Use what I typed" option for text that isn't in the list (free text, e.g. gear). */
    allowsCustomValue?: boolean;
    /** Shows a loading row instead of the empty message while results arrive. */
    isLoading?: boolean;
    onSelect?: (selection: ComboboxSelection) => void;
    defaultSelectedId?: string;
  };

export function Combobox({
  label,
  description,
  errorMessage,
  items,
  placeholder,
  allowsCustomValue = false,
  isLoading = false,
  onSelect,
  defaultSelectedId,
  ...rest
}: ComboboxProps) {
  const initial = items.find((i) => i.id === defaultSelectedId);
  const [inputValue, setInputValue] = useState(initial?.label ?? '');
  const [selectedKey, setSelectedKey] = useState<Key | null>(initial?.id ?? null);

  const visible = useMemo(() => {
    const matches = filterItems(items, inputValue, (i) => i.label);
    const typed = inputValue.trim();
    if (allowsCustomValue && typed && !hasExactMatch(items, typed, (i) => i.label)) {
      return [...matches, { id: CUSTOM_ID, label: typed }];
    }
    return matches;
  }, [items, inputValue, allowsCustomValue]);

  const rows = isLoading ? [{ id: LOADING_ID, label: 'Loading…' }, ...visible] : visible;

  return (
    <AriaComboBox
      {...rest}
      items={rows}
      inputValue={inputValue}
      onInputChange={(text) => {
        setInputValue(text);
        // Typing after a pick means the pick no longer applies.
        // (React Aria also reports the picked label as an input change; that one isn't typing.)
        const pickedLabel = items.find((i) => i.id === selectedKey)?.label;
        if (selectedKey != null && text !== pickedLabel) {
          setSelectedKey(null);
          onSelect?.({ kind: 'cleared' });
        }
      }}
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        if (key === LOADING_ID) return;
        if (key == null) {
          // React Aria reverts with nothing chosen (Escape, blur). In controlled mode putting the
          // text back is our job; otherwise it sees a mismatch and reopens the list straight away.
          if (selectedKey == null && !allowsCustomValue) setInputValue('');
          return;
        }
        if (key === CUSTOM_ID) {
          const text = inputValue.trim();
          setSelectedKey(null);
          onSelect?.({ kind: 'custom', text });
          return;
        }
        const item = items.find((i) => i.id === key);
        if (!item) return;
        setSelectedKey(key);
        setInputValue(item.label);
        onSelect?.({ kind: 'item', item });
      }}
      allowsEmptyCollection
      allowsCustomValue={allowsCustomValue}
      className={fieldStyles.field}
    >
      <FieldLabel required={rest.isRequired}>{label}</FieldLabel>
      <div className={cx(fieldStyles.control, styles.control)} data-primary-control="">
        <Input placeholder={placeholder} className={fieldStyles.input} />
        <Button
          className={styles.toggle}
          aria-label={`Show ${typeof label === 'string' ? label.toLowerCase() : 'options'}`}
        >
          <Icon icon={ChevronDown} size="md" />
        </Button>
      </div>
      {description ? <FieldHint>{description}</FieldHint> : null}
      <FieldError>{errorMessage}</FieldError>
      <Popover className={styles.popover} offset={4}>
        <ListBox
          className={styles.list}
          renderEmptyState={() => (
            <p className={styles.empty}>No matches. Keep typing or try another word.</p>
          )}
        >
          {(item: ComboboxItem) => (
            <ListBoxItem
              id={item.id}
              textValue={item.label}
              isDisabled={item.id === LOADING_ID}
              className={styles.item}
            >
              {item.id === CUSTOM_ID ? (
                <>
                  <Icon icon={Plus} size="sm" />
                  <span>
                    Use what I typed: <strong>{item.label}</strong>
                  </span>
                </>
              ) : (
                item.label
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaComboBox>
  );
}
