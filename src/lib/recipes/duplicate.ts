import type { RecipeRow, VersionRow } from './fetch';
import { LIMITS, versionSchema, type RecipeFormValues } from './schema';

const COPY_SUFFIX = ' (copy)';

/** "Morning V60 (copy)", shortened first if the name would no longer fit the limit. */
export function copyName(name: string): string {
  return `${name.trim().slice(0, LIMITS.name - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
}

/**
 * What `create_recipe` takes to duplicate one version of a recipe: a new private recipe with that
 * version as its v1. The version is read through the same schema as the editor, so the copy is
 * normalised exactly like a recipe made by hand; steps and gear snapshot are copied as they are.
 * It is not a credited copy (that is M7), and nothing is shared with the original.
 */
export function duplicateValues(
  recipe: Pick<RecipeRow, 'name' | 'method' | 'method_custom'>,
  version: VersionRow,
): RecipeFormValues {
  const parsed = versionSchema.parse(version);
  return {
    name: copyName(recipe.name),
    method: recipe.method,
    method_custom: recipe.method === 'other' ? (recipe.method_custom ?? null) : null,
    version: {
      ...parsed,
      change_note: `Duplicated from ${recipe.name} v${version.version_no}`.slice(0, LIMITS.changeNote),
    },
  };
}
