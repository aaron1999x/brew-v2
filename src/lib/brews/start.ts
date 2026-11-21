import type { RecipeWithVersion, VersionRow } from '@/lib/recipes/fetch';
import type { NewSessionInput } from './sessions';
import { toSessionVersion } from './sessions';

/**
 * Everything a brew session copies from a recipe version when it starts, so the timer and the log
 * keep working (and read the same) if the recipe changes or is deleted meanwhile.
 */
export function newSessionInput(
  data: Pick<RecipeWithVersion, 'recipe' | 'owner'> & { version: Pick<VersionRow, 'version_no'> },
  version: VersionRow,
  userId: string,
  entry: 'timer' | 'log',
): NewSessionInput {
  return {
    userId,
    recipeId: data.recipe.id,
    versionId: version.id,
    versionNo: version.version_no,
    latestVersionNo: data.version.version_no,
    handle: data.owner.handle,
    slug: data.recipe.slug,
    recipeName: data.recipe.name,
    method: data.recipe.method,
    entry,
    version: toSessionVersion(version, version.gear.grinder?.name ?? null),
  };
}
