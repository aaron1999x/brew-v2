import { describe, expect, it } from 'vitest';
import fixtureFile from '@/lib/recipes/__fixtures__/methods.json';
import { copyName, duplicateValues } from '@/lib/recipes/duplicate';
import type { RecipeRow, VersionRow } from '@/lib/recipes/fetch';
import { recipeFormSchema } from '@/lib/recipes/schema';

const recipe = (over: Partial<RecipeRow> = {}) =>
  ({ name: 'Morning V60', method: 'pour_over', method_custom: null, ...over }) as RecipeRow;
const version = (over: Record<string, unknown> = {}) =>
  ({
    id: 'v3',
    recipe_id: 'r1',
    version_no: 3,
    locked_at: '2026-11-10T00:00:00Z',
    change_note: 'finer grind',
    ...fixtureFile.fixtures[0]!.version,
    ...over,
  }) as unknown as VersionRow;

describe('copyName', () => {
  it('adds "(copy)"', () => {
    expect(copyName('Morning V60')).toBe('Morning V60 (copy)');
    expect(copyName('  Morning V60  ')).toBe('Morning V60 (copy)');
  });

  it('shortens a long name so the copy still fits the 80-character limit', () => {
    const copy = copyName('x'.repeat(80));
    expect(copy).toHaveLength(80);
    expect(copy.endsWith(' (copy)')).toBe(true);
  });
});

describe('duplicateValues', () => {
  it('makes a valid recipe form: it passes the same schema as the editor', () => {
    const parsed = recipeFormSchema.safeParse(duplicateValues(recipe(), version()));
    expect(parsed.success).toBe(true);
  });

  it('copies the viewed version and names the source in the change note', () => {
    const values = duplicateValues(recipe(), version());
    expect(values.name).toBe('Morning V60 (copy)');
    expect(values.version.change_note).toBe('Duplicated from Morning V60 v3');
    expect(values.version.dose_g).toBe(15);
    expect(values.version.steps.map((s) => s.id)).toEqual(
      fixtureFile.fixtures[0]!.version.steps.map((s) => s.id),
    );
    expect(values.version.gear).toEqual({ brewer: { name: 'Hario V60 02' } });
  });

  it('does not carry over the source version’s own change note, lock or number', () => {
    const values = duplicateValues(recipe(), version()) as unknown as Record<string, unknown>;
    expect(values.version).not.toHaveProperty('locked_at');
    expect(values.version).not.toHaveProperty('version_no');
    expect((values.version as { change_note: string }).change_note).not.toContain('finer grind');
  });

  it('keeps a custom method name only for the "Other" method', () => {
    expect(
      duplicateValues(recipe({ method: 'other', method_custom: 'Phin filter' }), version()).method_custom,
    ).toBe('Phin filter');
    expect(
      duplicateValues(recipe({ method: 'pour_over', method_custom: 'left over' }), version())
        .method_custom,
    ).toBeNull();
  });

  it('keeps the change note within its limit for a long name', () => {
    const values = duplicateValues(recipe({ name: 'x'.repeat(80) }), version());
    expect(values.version.change_note!.length).toBeLessThanOrEqual(200);
  });

  it('copies a 12-hour cold brew step exactly', () => {
    const cold = fixtureFile.fixtures.find((f) => f.key === 'cold_brew')!;
    const values = duplicateValues(
      recipe({ method: 'cold_brew' }),
      version({ ...cold.version }),
    );
    expect(values.version.steps.at(-1)).toMatchObject({ duration_s: 43_200 });
  });
});
