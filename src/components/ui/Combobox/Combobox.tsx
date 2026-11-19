'use client';

import { ChevronDown, Plus } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
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
    /** Text to start with when nothing from the list is selected (an earlier free-text entry). */
    defaultText?: string;
    /** Called with whatever is in the input as the person types (and when a pick fills it). */
    onTextChange?: (text: string) => void;
    /** Wording of the free-text option. Defaults to "Use what I typed: <text>". */
    customOptionLabel?: (typed: string) => string;
    /** Shown under the field instead of `description` while the input is empty. */
    emptyDescription?: ReactNode;
  };

export function Combobox({
  label,
  description,
  emptyDescription,
  errorMessage,
  items,
  placeholder,
  allowsCustomValue = false,
  isLoading = false,
  onSelect,
  defaultSelectedId,
  defaultText,
  onTextChange,
  customOptionLabel,
  ...rest
}: ComboboxProps) {
  const initial = items.find((i) => i.id === defaultSelectedId);
  const [inputValue, setInputValue] = useState(initial?.label ?? defaultText ?? '');
  const [selectedKey, setSelectedKey] = useState<Key | null>(initial?.id ?? null);
  // The text that was chosen through the "use what I typed" row (selectedKey is CUSTOM_ID then).
  const [customText, setCustomText] = useState('');
  // The text that is "settled": the starting value, or what the last pick put in the box. The list
  // only narrows down once the person changes it; until then it shows everything.
  const settledText = useRef(inputValue);
  const [filtering, setFiltering] = useState(false);
  const justFocused = useRef(false);

  const visible = useMemo(() => {
    const matches = filtering ? filterItems(items, inputValue, (i) => i.label) : [...items];
    const typed = inputValue.trim();
    // While results are still arriving the list can't be trusted: no "use what I typed" yet, so
    // ArrowDown + Enter can't choose it by accident before the real rows show up.
    if (
      filtering &&
      allowsCustomValue &&
      !isLoading &&
      typed &&
      !hasExactMatch(items, typed, (i) => i.label)
    ) {
      return [...matches, { id: CUSTOM_ID, label: typed }];
    }
    return matches;
  }, [items, inputValue, allowsCustomValue, isLoading, filtering]);

  const rows = isLoading ? [{ id: LOADING_ID, label: 'Loading…' }, ...visible] : visible;
  const hint = inputValue.trim() === '' && emptyDescription ? emptyDescription : description;

  return (
    <AriaComboBox
      {...rest}
      items={rows}
      inputValue={inputValue}
      onInputChange={(text) => {
        setInputValue(text);
        onTextChange?.(text);
        // React Aria also reports a pick's label as an input change; that one isn't typing.
        setFiltering(text !== settledText.current);
        // Typing after a pick means the pick no longer applies.
        const pickedLabel =
          selectedKey === CUSTOM_ID ? customText : items.find((i) => i.id === selectedKey)?.label;
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
          // Count it as a real selection: that is what makes React Aria close the list. (Leaving
          // the key empty kept the list open over the rest of the form.) Typing again clears it.
          const text = inputValue.trim();
          settledText.current = text;
          setFiltering(false);
          setSelectedKey(CUSTOM_ID);
          setCustomText(text);
          setInputValue(text);
          onTextChange?.(text);
          onSelect?.({ kind: 'custom', text });
          return;
        }
        const item = items.find((i) => i.id === key);
        if (!item) return;
        settledText.current = item.label;
        setFiltering(false);
        setSelectedKey(key);
        setInputValue(item.label);
        onTextChange?.(item.label);
        onSelect?.({ kind: 'item', item });
      }}
      allowsEmptyCollection
      allowsCustomValue={allowsCustomValue}
      className={fieldStyles.field}
    >
      <FieldLabel required={rest.isRequired}>{label}</FieldLabel>
      <div className={cx(fieldStyles.control, styles.control)} data-primary-control="">
        <Input
          placeholder={placeholder}
          className={fieldStyles.input}
          // Typing replaces what is there: the box starts with its text selected.
          onFocus={(event) => {
            justFocused.current = true;
            event.currentTarget.select();
          }}
          // The click that gave focus must not drop the selection again on release.
          onMouseUp={(event) => {
            if (justFocused.current) event.preventDefault();
            justFocused.current = false;
          }}
        />
        <Button
          className={styles.toggle}
          aria-label={`Show ${typeof label === 'string' ? label.toLowerCase() : 'options'}`}
        >
          <Icon icon={ChevronDown} size="md" />
        </Button>
      </div>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
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
                  {customOptionLabel ? (
                    <span>{customOptionLabel(item.label)}</span>
                  ) : (
                    <span>
                      Use what I typed: <strong>{item.label}</strong>
                    </span>
                  )}
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
