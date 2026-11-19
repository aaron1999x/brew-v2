import { versionDiffInput, type DiffInput, type VersionDiff } from './diff';
import type { RecipeRow, VersionRow } from './fetch';
import type { RecipeFormValues } from './schema';

/**
 * What saving does in each editor mode, decided in one place so the button label, the summary and
 * the database call can't disagree.
 *
 *  - create       a new recipe, v1
 *  - edit         the version being viewed: in place while it has no brews; once it has brews
 *                 only name, notes and the change note can still change in place (the database
 *                 refuses anything else), so any other change becomes the next version
 *  - new-version  always the next version, pre-filled from the version it starts from
 */
export type EditorMode = 'create' | 'edit' | 'new-version';
export type SaveAction = 'nothing' | 'in-place' | 'new-version';

/** Fields that can change on a version that already has brews. */
const LOCKED_VERSION_KEYS: ReadonlySet<string> = new Set(['basics.name', 'notes.notes']);

export function decideSave(input: {
  mode: Exclude<EditorMode, 'create'>;
  locked: boolean;
  diff: Pick<VersionDiff, 'count' | 'fields' | 'steps'>;
  /** The change note differs from what is stored on the base version. */
  noteChanged: boolean;
}): SaveAction {
  const { mode, locked, diff, noteChanged } = input;
  if (diff.count === 0 && !noteChanged) return 'nothing';
  if (mode === 'new-version') return 'new-version';
  if (!locked) return 'in-place';
  const onlyAllowed = diff.steps.length === 0 && diff.fields.every((f) => LOCKED_VERSION_KEYS.has(f.key));
  return onlyAllowed ? 'in-place' : 'new-version';
}

/** "3 fields changed", "1 field changed", "No changes yet". Steps count as fields, as in the diff. */
export function changeSummary(count: number): string {
  if (count === 0) return 'No changes yet';
  return count === 1 ? '1 field changed' : `${count} fields changed`;
}

/** A parsed editor form as something the diff can compare with a stored version. */
export function formDiffInput(values: RecipeFormValues): DiffInput {
  return {
    name: values.name,
    method: values.method,
    method_custom: values.method_custom,
    ...values.version,
  };
}

/** A stored recipe and version as something the diff can compare with the editor. */
export function storedDiffInput(
  recipe: Pick<RecipeRow, 'name' | 'method' | 'method_custom'>,
  version: VersionRow,
): DiffInput {
  return versionDiffInput(recipe, version as unknown as Record<string, unknown>);
}
