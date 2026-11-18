import {
  GEAR_CATEGORIES,
  GEAR_CATEGORY_LABELS,
  gearRealName,
  type GearCategory,
  type GearItem,
} from '@/lib/recipes/gear';
import {
  legacyFavouriteSchema,
  linkedFavouriteSchema,
  type LegacyFavourite,
  type LinkedFavourite,
} from '@/lib/recipes/schema';

export { GEAR_CATEGORIES };
export type { GearCategory, LegacyFavourite, LinkedFavourite };

export const MAX_FAVOURITE_GEAR = 5;

export function gearCategoryLabel(category: string): string {
  return GEAR_CATEGORY_LABELS[category as GearCategory] ?? GEAR_CATEGORY_LABELS.other;
}

/**
 * An entry of `profiles.favourite_gear`: linked to one of my gear items (`item_id`, kept in step
 * by a database trigger when the item is renamed or deleted) or a legacy free-text entry from M2.
 */
export type FavouriteGear = LinkedFavourite | LegacyFavourite;

export function isLinkedFavourite(entry: FavouriteGear): entry is LinkedFavourite {
  return 'item_id' in entry && typeof entry.item_id === 'string';
}

/** Reads the stored JSON; entries that don't fit are dropped, at most five kept. */
export function parseFavouriteGear(value: unknown): FavouriteGear[] {
  if (!Array.isArray(value)) return [];
  const out: FavouriteGear[] = [];
  for (const item of value) {
    const linked = linkedFavouriteSchema.safeParse(item);
    if (linked.success) {
      out.push(linked.data);
      continue;
    }
    const legacy = legacyFavouriteSchema.safeParse(item);
    if (legacy.success) out.push(legacy.data);
  }
  return out.slice(0, MAX_FAVOURITE_GEAR);
}

/** The entry saved for a gear item: its real name (catalogue or custom), never its nickname. */
export function favouriteFromItem(item: GearItem): LinkedFavourite {
  return { item_id: item.id, category: item.category, name: gearRealName(item) };
}

/**
 * What to store: the chosen gear items (in the order chosen) followed by the legacy entries that
 * are still wanted. Chosen ids that no longer match an item of mine are dropped.
 */
export function buildFavouriteGear(
  chosenIds: readonly string[],
  items: readonly GearItem[],
  legacy: readonly LegacyFavourite[],
): FavouriteGear[] {
  const linked = chosenIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is GearItem => item !== undefined)
    .map(favouriteFromItem);
  return [...linked, ...legacy].slice(0, MAX_FAVOURITE_GEAR);
}
