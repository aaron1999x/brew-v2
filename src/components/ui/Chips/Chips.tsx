'use client';

import { Check, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  Button as AriaButton,
  Input,
  Label,
  Tag,
  TagGroup,
  TagList,
  ToggleButton,
  type Selection,
  type ToggleButtonProps,
} from 'react-aria-components';
import { cx } from '@/lib/cx';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './Chips.module.css';

/** A filter that is on or off, e.g. a brew method. The check mark means "on" without colour. */
export function FilterChip({
  children,
  ...rest
}: Omit<ToggleButtonProps, 'className' | 'style' | 'children'> & { children: string }) {
  return (
    <ToggleButton {...rest} className={styles.chip} data-primary-control="">
      {({ isSelected }) => (
        <>
          {isSelected ? <Icon icon={Check} size="sm" /> : null}
          <span>{children}</span>
        </>
      )}
    </ToggleButton>
  );
}

export type ChipTag = { id: string; label: string };

type TagChipsProps = {
  /** Names the group, e.g. "Flavour notes". Shown above the chips. */
  label: string;
  tags: readonly ChipTag[];
  selectedKeys: Iterable<string>;
  onSelectionChange: (keys: Set<string>) => void;
  /** When given, every tag can be removed (used for tags the brewer added). */
  onRemove?: (id: string) => void;
  /** Ids that are removable even when `onRemove` applies to all; others stay fixed. */
  removableIds?: ReadonlySet<string>;
  emptyText?: string;
};

/** Selectable flavour tags. Space/Enter toggles; Delete/Backspace removes a removable tag. */
export function TagChips({
  label,
  tags,
  selectedKeys,
  onSelectionChange,
  onRemove,
  removableIds,
  emptyText = 'No tags yet.',
}: TagChipsProps) {
  // React Aria renders an empty group with an ARIA attribute axe rejects, so show plain text instead.
  if (tags.length === 0) {
    return (
      <div className={styles.group}>
        <p className={styles.groupLabel}>{label}</p>
        <span className={styles.empty}>{emptyText}</span>
      </div>
    );
  }

  return (
    <TagGroup
      selectionMode="multiple"
      selectedKeys={selectedKeys}
      onSelectionChange={(keys: Selection) =>
        onSelectionChange(
          keys === 'all' ? new Set(tags.map((t) => t.id)) : new Set([...keys].map(String)),
        )
      }
      onRemove={onRemove ? (keys) => keys.forEach((k) => onRemove(String(k))) : undefined}
      className={styles.group}
    >
      <Label className={styles.groupLabel}>{label}</Label>
      <TagList
        items={tags}
        className={styles.list}
        renderEmptyState={() => <span className={styles.empty}>{emptyText}</span>}
      >
        {(tag) => (
          <Tag id={tag.id} textValue={tag.label} className={styles.tag} data-primary-control="">
            {({ isSelected, allowsRemoving }) => {
              const removable = allowsRemoving && (!removableIds || removableIds.has(tag.id));
              return (
                <>
                  {isSelected ? <Icon icon={Check} size="sm" /> : null}
                  <span>{tag.label}</span>
                  {removable ? (
                    <AriaButton
                      slot="remove"
                      className={styles.remove}
                      aria-label={`Remove ${tag.label}`}
                    >
                      <Icon icon={X} size="sm" />
                    </AriaButton>
                  ) : null}
                </>
              );
            }}
          </Tag>
        )}
      </TagList>
    </TagGroup>
  );
}

/** "Add your own" input for tags. Enter or the button adds; blank text is ignored. */
export function AddTagField({
  label = 'Add your own',
  onAdd,
}: {
  label?: string;
  onAdd: (text: string) => void;
}) {
  const [text, setText] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    onAdd(value);
    setText('');
  }

  return (
    <form onSubmit={submit} className={styles.add}>
      <label className={styles.groupLabel} htmlFor="add-tag-input">
        {label}
      </label>
      <div className={styles.addRow}>
        <Input
          id="add-tag-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={30}
          placeholder="e.g. toasted almond"
          className={cx(styles.addInput)}
          data-primary-control=""
        />
        <Button type="submit" variant="secondary">
          Add
        </Button>
      </div>
    </form>
  );
}
