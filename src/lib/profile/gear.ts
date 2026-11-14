import { z } from 'zod';

export const GEAR_CATEGORIES = [
  { value: 'brewer', label: 'Brewer' },
  { value: 'filter', label: 'Filter' },
  { value: 'grinder', label: 'Grinder' },
  { value: 'kettle', label: 'Kettle' },
  { value: 'scale', label: 'Scale' },
  { value: 'water', label: 'Water' },
  { value: 'other', label: 'Other' },
] as const;

export type GearCategory = (typeof GEAR_CATEGORIES)[number]['value'];

export const MAX_FAVOURITE_GEAR = 5;
export const MAX_GEAR_NAME = 60;

export function gearCategoryLabel(category: string): string {
  return GEAR_CATEGORIES.find((c) => c.value === category)?.label ?? 'Other';
}

const categoryValues = GEAR_CATEGORIES.map((c) => c.value) as [GearCategory, ...GearCategory[]];

export const favouriteGearSchema = z.object({
  category: z.enum(categoryValues),
  name: z.string().trim().min(1).max(MAX_GEAR_NAME),
});

export type FavouriteGear = z.infer<typeof favouriteGearSchema>;

/** Reads the stored `favourite_gear` JSON; entries that don't fit are dropped, at most five kept. */
export function parseFavouriteGear(value: unknown): FavouriteGear[] {
  if (!Array.isArray(value)) return [];
  const out: FavouriteGear[] = [];
  for (const item of value) {
    const parsed = favouriteGearSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out.slice(0, MAX_FAVOURITE_GEAR);
}

/** Rows from the edit form → what is stored: empty names are dropped, names trimmed, max five. */
export function cleanFavouriteGear(
  rows: readonly { category: string; name: string }[],
): FavouriteGear[] {
  return rows
    .map((r) => ({
      category: (GEAR_CATEGORIES.some((c) => c.value === r.category)
        ? r.category
        : 'other') as GearCategory,
      name: r.name.trim().slice(0, MAX_GEAR_NAME),
    }))
    .filter((r) => r.name !== '')
    .slice(0, MAX_FAVOURITE_GEAR);
}
