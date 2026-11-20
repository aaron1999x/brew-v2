import { gearItemFormSchema } from '@/lib/recipes/schema';
import type { GearCategory, GearItem } from '@/lib/recipes/gear';
import type { GearInput } from './hooks';

/** What was chosen in the gear picker: a catalogue row, or the person's own name for it. */
export type GearPick = { kind: 'catalog'; id: string } | { kind: 'custom'; text: string };

/** The pick to start from when editing an item (or none when adding). */
export function pickFromItem(item: GearItem | null): GearPick | null {
  if (!item) return null;
  if (item.catalog_id) return { kind: 'catalog', id: item.catalog_id };
  if (item.custom_name) return { kind: 'custom', text: item.custom_name };
  return null;
}

/** What every gear picker says, so custom gear can be found (My gear, onboarding, the recipe editor). */
export const GEAR_PICKER_PLACEHOLDER = 'Search by brand or model, or type your own.';
export const GEAR_PICKER_EMPTY_HINT = 'Not listed? Type its name to add it as your own.';

/** Wording of the free-text option at the end of the picker's list. */
export const customItemLabel = (typed: string): string => `Use “${typed}” as a custom item`;

/** What to say when text was typed but nothing was chosen from the list. */
export function missingPickMessage(typed: string): string {
  const text = typed.trim();
  return text
    ? `Choose an item from the list, or pick “${customItemLabel(text)}”.`
    : 'Search for an item, or type your own name for it.';
}

export type GearFormField = 'item' | 'nickname' | 'notes';
export type GearFormError = { field: GearFormField; message: string };

export type GearFormValues = {
  category: GearCategory;
  pick: GearPick | null;
  /** Whatever is in the picker's input (used to explain an unmade choice). */
  typed: string;
  nickname: string;
  notes: string;
};

/** Checks a gear form on submit. Returns the values to save, or what is wrong, field by field. */
export function buildGearInput(
  values: GearFormValues,
): { ok: true; input: GearInput } | { ok: false; errors: GearFormError[] } {
  if (!values.pick) {
    return { ok: false, errors: [{ field: 'item', message: missingPickMessage(values.typed) }] };
  }
  const parsed = gearItemFormSchema.safeParse({
    category: values.category,
    catalog_id: values.pick.kind === 'catalog' ? values.pick.id : null,
    custom_name: values.pick.kind === 'custom' ? values.pick.text : null,
    nickname: values.nickname,
    notes: values.notes,
  });
  if (!parsed.success) {
    const errors: GearFormError[] = parsed.error.issues.map((issue) => {
      const key = String(issue.path[0] ?? '');
      const field: GearFormField =
        key === 'nickname' ? 'nickname' : key === 'notes' ? 'notes' : 'item';
      return { field, message: issue.message };
    });
    return { ok: false, errors };
  }
  const { category, catalog_id, custom_name, nickname, notes } = parsed.data;
  return { ok: true, input: { category, catalog_id, custom_name, nickname, notes } };
}
