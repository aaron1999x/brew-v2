'use client';

import { useMemo, useRef } from 'react';
import { Combobox } from '@/components/ui/Combobox/Combobox';
import { GEAR_PICKER_EMPTY_HINT, GEAR_PICKER_PLACEHOLDER, customItemLabel } from '@/lib/gear/form';
import {
  gearDisplayName,
  gearPickerOrder,
  type CatalogEntry,
  type GearChoice,
  type GearItem,
  type RecipeGearCategory,
} from '@/lib/recipes/gear';

type Props = {
  id: string;
  label: string;
  category: RecipeGearCategory;
  /** My gear: the first rows of the list, defaults first. */
  myGear: readonly GearItem[];
  catalog: readonly CatalogEntry[];
  isLoading?: boolean;
  value: GearChoice | null;
  onChange: (choice: GearChoice | null) => void;
  description?: string;
};

const ITEM_PREFIX = 'item:';
const CATALOG_PREFIX = 'cat:';

/** What the input shows for a choice. */
function choiceLabel(choice: GearChoice | null): string {
  if (!choice) return '';
  switch (choice.kind) {
    case 'item':
      return gearDisplayName(choice.item);
    case 'catalog':
      return choice.catalog.name;
    case 'text':
      return choice.text;
    case 'snapshot':
      return choice.entry.name;
  }
}

/**
 * One gear category on the recipe form: my gear first (defaults on top), then the catalogue, and
 * free text for anything else. Typing your own name counts straight away, so nothing typed is
 * dropped silently; choosing a row replaces it. A saved recipe keeps the entry it was saved with
 * until someone changes it here.
 */
export function RecipeGearPicker({
  id,
  label,
  category,
  myGear,
  catalog,
  isLoading,
  value,
  onChange,
  description,
}: Props) {
  const mine = useMemo(() => gearPickerOrder(myGear, category), [myGear, category]);
  const items = useMemo(
    () => [
      ...mine.map((item) => ({ id: `${ITEM_PREFIX}${item.id}`, label: gearDisplayName(item) })),
      ...catalog
        .filter((c) => c.category === category)
        .map((c) => ({ id: `${CATALOG_PREFIX}${c.id}`, label: c.name })),
    ],
    [mine, catalog, category],
  );

  // The latest choice, updated at once: a pick fires a text change and a selection in one event.
  const current = useRef<GearChoice | null>(value);
  const typed = useRef('');
  const emit = (choice: GearChoice | null) => {
    current.current = choice;
    onChange(choice);
  };

  const selectedId =
    value?.kind === 'item'
      ? `${ITEM_PREFIX}${value.item.id}`
      : value?.kind === 'catalog'
        ? `${CATALOG_PREFIX}${value.catalog.id}`
        : undefined;
  const initialText = choiceLabel(value);

  return (
    <Combobox
      id={id}
      label={label}
      description={description}
      items={items}
      isLoading={isLoading}
      placeholder={GEAR_PICKER_PLACEHOLDER}
      emptyDescription={description ?? GEAR_PICKER_EMPTY_HINT}
      allowsCustomValue
      customOptionLabel={customItemLabel}
      defaultSelectedId={selectedId}
      defaultText={initialText || undefined}
      onTextChange={(text) => {
        typed.current = text;
        // The input filling in after a pick isn't typing.
        if (text === choiceLabel(current.current)) return;
        const trimmed = text.trim();
        emit(trimmed ? { kind: 'text', text: trimmed } : null);
      }}
      onSelect={(selection) => {
        if (selection.kind === 'cleared') {
          const trimmed = typed.current.trim();
          emit(trimmed ? { kind: 'text', text: trimmed } : null);
          return;
        }
        if (selection.kind === 'custom') {
          emit({ kind: 'text', text: selection.text });
          return;
        }
        const pickedId = selection.item.id;
        if (pickedId.startsWith(ITEM_PREFIX)) {
          const item = mine.find((i) => `${ITEM_PREFIX}${i.id}` === pickedId);
          if (item) emit({ kind: 'item', item });
          return;
        }
        const entry = catalog.find((c) => `${CATALOG_PREFIX}${c.id}` === pickedId);
        if (entry) emit({ kind: 'catalog', catalog: { id: entry.id, name: entry.name } });
      }}
    />
  );
}
