'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button/Button';
import {
  FormErrorSummary,
  type FormError,
} from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { Select } from '@/components/ui/Select/Select';
import { Sheet, SheetActions } from '@/components/ui/Sheet/Sheet';
import { Switch } from '@/components/ui/Switch/Switch';
import { TextField } from '@/components/ui/TextField/TextField';
import { Textarea } from '@/components/ui/Textarea/Textarea';
import { toast } from '@/components/ui/Toast/toast';
import { buildGearInput, pickFromItem, type GearPick } from '@/lib/gear/form';
import { useAddGear, useGearCatalog, useUpdateGear } from '@/lib/gear/hooks';
import {
  GEAR_CATEGORIES,
  GEAR_CATEGORY_LABELS,
  gearDisplayName,
  type GearCategory,
  type GearItem,
} from '@/lib/recipes/gear';
import { LIMITS } from '@/lib/recipes/schema';
import { GearPicker } from './GearPicker';
import styles from './Gear.module.css';

const ID = {
  item: 'gear-item',
  nickname: 'gear-nickname',
  notes: 'gear-notes',
};

type Props = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** The item being edited, or null to add one. */
  item: GearItem | null;
  /** Called (after the sheet closes) when the person asks to delete the item. */
  onDelete: (item: GearItem) => void;
};

/**
 * Add or edit a gear item: category, then the catalogue search (or your own name), nickname,
 * notes and "Use as default for new recipes". Fits above the iPhone keyboard (the shared Sheet
 * follows the visual viewport). Validates on submit; the button is never disabled.
 */
export function GearSheet({ isOpen, onOpenChange, item, onDelete }: Props) {
  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={item ? 'Edit gear' : 'Add gear'}>
      {(close) => (
        <GearForm
          // A fresh form for every item, and for every time the sheet opens.
          item={item}
          close={close}
          onDelete={
            item
              ? () => {
                  close();
                  onDelete(item);
                }
              : undefined
          }
        />
      )}
    </Sheet>
  );
}

function GearForm({
  item,
  close,
  onDelete,
}: {
  item: GearItem | null;
  close: () => void;
  onDelete?: () => void;
}) {
  const catalog = useGearCatalog();
  const add = useAddGear();
  const update = useUpdateGear();

  const [category, setCategory] = useState<GearCategory>(item?.category ?? 'brewer');
  const [pick, setPick] = useState<GearPick | null>(() => pickFromItem(item));
  const [typed, setTyped] = useState(() => {
    const initial = pickFromItem(item);
    return initial?.kind === 'custom' ? initial.text : '';
  });
  const [nickname, setNickname] = useState(item?.nickname ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [isDefault, setIsDefault] = useState(item?.is_default ?? false);
  const [errors, setErrors] = useState<(FormError & { field: string })[]>([]);

  const pending = add.isPending || update.isPending;
  const fieldError = (id: string) => errors.find((e) => e.fieldId === id)?.message;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildGearInput({ category, pick, typed, nickname, notes });
    if (!result.ok) {
      setErrors(
        result.errors.map((e) => ({ field: e.field, fieldId: ID[e.field], message: e.message })),
      );
      return;
    }
    setErrors([]);
    try {
      if (item) {
        await update.mutateAsync({ id: item.id, ...result.input, is_default: isDefault });
        toast.success('Gear saved.');
      } else {
        await add.mutateAsync({ ...result.input, is_default: isDefault });
        toast.success('Gear added.');
      }
      close();
    } catch {
      // The hook already showed an error toast; the sheet stays open with everything typed.
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={styles.form}
      aria-label={item ? 'Edit gear' : 'Add gear'}
    >
      <FormErrorSummary errors={errors} />
      <Select
        label="Category"
        options={GEAR_CATEGORIES.map((c) => ({ id: c, label: GEAR_CATEGORY_LABELS[c] }))}
        selectedKey={category}
        onSelectionChange={(key) => {
          const next = String(key) as GearCategory;
          if (next === category) return;
          setCategory(next);
          // Catalogue rows belong to one category; a name you typed yourself carries over.
          if (pick?.kind === 'catalog') {
            setPick(null);
            setTyped('');
          }
        }}
      />
      <GearPicker
        id={ID.item}
        label="Item"
        category={category}
        catalog={catalog.data ?? []}
        isLoading={catalog.isPending}
        value={pick}
        onChange={setPick}
        onTextChange={setTyped}
        errorMessage={fieldError(ID.item)}
      />
      <TextField
        id={ID.nickname}
        label="Nickname (optional)"
        value={nickname}
        onChange={setNickname}
        maxLength={LIMITS.nickname}
        isInvalid={Boolean(fieldError(ID.nickname))}
        errorMessage={fieldError(ID.nickname)}
      />
      <div>
        <Textarea
          id={ID.notes}
          label="Notes (optional)"
          description="e.g. grinder zero point, burr set"
          value={notes}
          onChange={setNotes}
          isInvalid={Boolean(fieldError(ID.notes))}
          errorMessage={fieldError(ID.notes)}
        />
        <p className={styles.counter} aria-live="polite">
          {notes.length}/{LIMITS.gearNotes}
        </p>
      </div>
      <Switch isSelected={isDefault} onChange={setIsDefault}>
        Use as default for new recipes
      </Switch>
      <SheetActions>
        <Button variant="secondary" onPress={close} isDisabled={pending}>
          Cancel
        </Button>
        <Button type="submit" isPending={pending} pendingLabel="Saving…">
          {item ? 'Save changes' : 'Add gear'}
        </Button>
      </SheetActions>
      {onDelete ? (
        <div className={styles.deleteRow}>
          <Button variant="ghost" onPress={onDelete} isDisabled={pending}>
            Delete {item ? gearDisplayName(item) : 'this item'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
