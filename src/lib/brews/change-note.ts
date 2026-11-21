import {
  TEMP_LABEL,
  WEIGHT_LABEL,
  tempToDisplay,
  weightToDisplay,
  type UnitSettings,
} from '@/lib/units';
import { changedFields, type QuickChangeBase } from './quick-change';
import type { QuickChange } from './schema';

/** The longest a version's change note can be (the database check). */
export const CHANGE_NOTE_MAX = 200;
export const CHANGE_NOTE_PREFIX = 'Brewed with changes: ';

type UnitPrefs = Pick<UnitSettings, 'temp_unit' | 'weight_unit'>;

const NONE = '—';

/** The changes as short phrases in the user's units: ["grind 18 → 17", "93 → 94 °C", "dose 15 → 16 g"]. */
export function describeChanges(
  base: QuickChangeBase,
  change: QuickChange | null | undefined,
  units: UnitPrefs,
): string[] {
  const temp = (c: number | null) => (c == null ? NONE : String(tempToDisplay(c, units.temp_unit)));
  const weight = (g: number) => String(weightToDisplay(g, units.weight_unit));
  return changedFields(base, change).map((f) => {
    switch (f.field) {
      case 'grind':
        return `grind ${f.from ?? NONE} → ${f.to ?? NONE}`;
      case 'temp':
        return `${temp(f.from)} → ${temp(f.to)} ${TEMP_LABEL[units.temp_unit]}`;
      case 'dose':
        return `dose ${weight(f.from)} → ${weight(f.to)} ${WEIGHT_LABEL[units.weight_unit]}`;
      case 'water':
        return `water ${weight(f.from)} → ${weight(f.to)} ${WEIGHT_LABEL[units.weight_unit]}`;
    }
  });
}

/**
 * The change note saved on the new version: "Brewed with changes: grind 18 → 17, 93 → 94 °C",
 * in the units the person uses, cut to the database limit. Empty when nothing changed.
 */
export function changeNote(
  base: QuickChangeBase,
  change: QuickChange | null | undefined,
  units: UnitPrefs,
): string {
  const parts = describeChanges(base, change, units);
  if (parts.length === 0) return '';
  const note = `${CHANGE_NOTE_PREFIX}${parts.join(', ')}`;
  return note.length > CHANGE_NOTE_MAX ? `${note.slice(0, CHANGE_NOTE_MAX - 1)}…` : note;
}

/** The line under the Change for this brew fields: "Grind 18 → 17 · 93 → 94 °C". */
export function changeSummary(
  base: QuickChangeBase,
  change: QuickChange | null | undefined,
  units: UnitPrefs,
): string {
  const parts = describeChanges(base, change, units);
  if (parts.length === 0) return '';
  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
