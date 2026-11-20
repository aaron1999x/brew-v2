'use client';

import { useMemo } from 'react';
import { Combobox } from '@/components/ui/Combobox/Combobox';
import {
  GEAR_PICKER_EMPTY_HINT,
  GEAR_PICKER_PLACEHOLDER,
  customItemLabel,
  type GearPick,
} from '@/lib/gear/form';
import type { CatalogEntry, GearCategory } from '@/lib/recipes/gear';

type Props = {
  /** Used for the error summary link and the label. */
  id?: string;
  label: string;
  category: GearCategory;
  catalog: readonly CatalogEntry[];
  isLoading?: boolean;
  value: GearPick | null;
  onChange: (pick: GearPick | null) => void;
  /** Whatever is in the input, so submit can explain a choice that wasn't made. */
  onTextChange?: (text: string) => void;
  errorMessage?: string;
  description?: string;
};

/**
 * Search the catalogue for one category (brand and model), or use your own name: when nothing fits,
 * the last option is "Use “<typed text>” as a custom item". Remounts when the category changes.
 */
export function GearPicker({
  id,
  label,
  category,
  catalog,
  isLoading,
  value,
  onChange,
  onTextChange,
  errorMessage,
  description,
}: Props) {
  const items = useMemo(
    () => catalog.filter((c) => c.category === category).map((c) => ({ id: c.id, label: c.name })),
    [catalog, category],
  );

  return (
    <Combobox
      // A different category is a different list: start the input afresh.
      key={category}
      id={id}
      label={label}
      description={description}
      errorMessage={errorMessage}
      isInvalid={Boolean(errorMessage)}
      items={items}
      isLoading={isLoading}
      placeholder={GEAR_PICKER_PLACEHOLDER}
      emptyDescription={description ?? GEAR_PICKER_EMPTY_HINT}
      allowsCustomValue
      customOptionLabel={customItemLabel}
      defaultSelectedId={value?.kind === 'catalog' ? value.id : undefined}
      defaultText={value?.kind === 'custom' ? value.text : undefined}
      onTextChange={onTextChange}
      onSelect={(selection) => {
        if (selection.kind === 'item') onChange({ kind: 'catalog', id: selection.item.id });
        else if (selection.kind === 'custom') onChange({ kind: 'custom', text: selection.text });
        else onChange(null);
      }}
    />
  );
}
