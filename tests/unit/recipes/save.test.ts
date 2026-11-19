import { describe, expect, it } from 'vitest';
import fixtureFile from '@/lib/recipes/__fixtures__/methods.json';
import { diffVersions } from '@/lib/recipes/diff';
import { draftFromVersion, parseDraft, type RecipeDraft } from '@/lib/recipes/draft';
import type { RecipeRow, VersionRow } from '@/lib/recipes/fetch';
import { changeSummary, decideSave, formDiffInput, storedDiffInput } from '@/lib/recipes/save';

type Fixture = (typeof fixtureFile.fixtures)[number];

/** A stored recipe and version, as the database returns them, built from a method fixture. */
function stored(f: Fixture, over: Partial<VersionRow> = {}) {
  const recipe = {
    id: 'r1',
    name: f.name,
    method: f.method,
    method_custom: f.method_custom,
  } as unknown as RecipeRow;
  const version = {
    id: 'v1',
    recipe_id: 'r1',
    version_no: 1,
    locked_at: null,
    change_note: null,
    steps_schema: 1,
    ...f.version,
    ...over,
  } as unknown as VersionRow;
  return { recipe, version };
}

function changed(f: Fixture, edit: (d: RecipeDraft) => RecipeDraft) {
  const { recipe, version } = stored(f);
  const draft = edit(draftFromVersion(recipe, version, { keepChangeNote: true }));
  const parsed = parseDraft(draft);
  if (!parsed.ok) throw new Error(`draft should be valid: ${JSON.stringify(parsed.errors)}`);
  return diffVersions(storedDiffInput(recipe, version), formDiffInput(parsed.values));
}

describe('draftFromVersion round trip', () => {
  for (const f of fixtureFile.fixtures) {
    it(`${f.key}: opening a saved version in the editor changes nothing`, () => {
      expect(changed(f, (d) => d).count).toBe(0);
    });
  }

  it('keeps the steps with their ids, so a new version can be compared step by step', () => {
    const f = fixtureFile.fixtures[0]!;
    const { recipe, version } = stored(f);
    const draft = draftFromVersion(recipe, version, { keepChangeNote: false });
    expect(draft.steps.map((s) => s.id)).toEqual(f.version.steps.map((s) => s.id));
  });

  it('starts from the version’s own gear snapshot, never from today’s defaults', () => {
    const f = fixtureFile.fixtures[0]!;
    const { recipe, version } = stored(f);
    const draft = draftFromVersion(recipe, version, { keepChangeNote: false });
    expect(draft.gear.brewer).toMatchObject({ kind: 'snapshot', entry: { name: 'Hario V60 02' } });
  });

  it('copies the change note into an edit, and starts a new version with none', () => {
    const f = fixtureFile.fixtures[0]!;
    const { recipe, version } = stored(f, { change_note: 'finer grind' });
    expect(draftFromVersion(recipe, version, { keepChangeNote: true }).change_note).toBe('finer grind');
    expect(draftFromVersion(recipe, version, { keepChangeNote: false }).change_note).toBe('');
  });

  it('turns "Vary temperature by pour" on when a pour has a temperature', () => {
    const f = fixtureFile.fixtures[0]!;
    const steps = f.version.steps.map((s, i) => (i === 0 ? { ...s, temp_c: 92 } : s));
    const { recipe, version } = stored(f, { steps } as unknown as Partial<VersionRow>);
    expect(draftFromVersion(recipe, version, { keepChangeNote: true }).vary_temp).toBe(true);
    expect(
      draftFromVersion(...Object.values(stored(f)) as [RecipeRow, VersionRow], { keepChangeNote: true })
        .vary_temp,
    ).toBe(false);
  });
});

describe('what changed in the editor', () => {
  const v60 = fixtureFile.fixtures[0]!;

  it('counts a finer grind and a lower temperature as two fields', () => {
    const diff = changed(v60, (d) => ({ ...d, grind_setting: '22 clicks', temp_c: 92 }));
    expect(diff.count).toBe(2);
    expect([...diff.changedKeys].sort()).toEqual(['numbers.grind_setting', 'numbers.temp_c']);
  });

  it('counts a changed step as one change', () => {
    const diff = changed(v60, (d) => ({
      ...d,
      steps: d.steps.map((s, i) => (i === 2 ? { ...s, target_g: 160 } : s)),
    }));
    expect(diff.count).toBe(1);
    expect(diff.steps[0]).toMatchObject({ change: 'changed' });
  });

  it('does not count the change note, which describes the new version rather than being a setting', () => {
    expect(changed(v60, (d) => ({ ...d, change_note: 'finer grind' })).count).toBe(0);
  });

  it('does not count the gear when the snapshot is kept as it was', () => {
    const diff = changed(v60, (d) => ({ ...d, gear: { ...d.gear } }));
    expect(diff.count).toBe(0);
  });
});

describe('decideSave', () => {
  const none = { count: 0, fields: [], steps: [] };
  const field = (key: string) => ({ count: 1, fields: [{ key }] as never, steps: [] });

  it('does nothing when nothing changed', () => {
    for (const mode of ['edit', 'new-version'] as const) {
      for (const locked of [false, true]) {
        expect(decideSave({ mode, locked, diff: none, noteChanged: false })).toBe('nothing');
      }
    }
  });

  it('edits an unlocked version in place', () => {
    expect(decideSave({ mode: 'edit', locked: false, diff: field('numbers.dose_g'), noteChanged: false })).toBe(
      'in-place',
    );
  });

  it('saves a change to a locked version as the next version', () => {
    expect(decideSave({ mode: 'edit', locked: true, diff: field('numbers.dose_g'), noteChanged: false })).toBe(
      'new-version',
    );
    expect(
      decideSave({
        mode: 'edit',
        locked: true,
        diff: { count: 1, fields: [], steps: [{}] as never },
        noteChanged: false,
      }),
    ).toBe('new-version');
  });

  it('still saves a locked version in place when only the name, notes or change note changed', () => {
    expect(decideSave({ mode: 'edit', locked: true, diff: field('notes.notes'), noteChanged: false })).toBe(
      'in-place',
    );
    expect(decideSave({ mode: 'edit', locked: true, diff: field('basics.name'), noteChanged: false })).toBe(
      'in-place',
    );
    expect(decideSave({ mode: 'edit', locked: true, diff: none, noteChanged: true })).toBe('in-place');
  });

  it('sends a locked change to the next version when a note change comes with a real one', () => {
    const both = { count: 2, fields: [{ key: 'notes.notes' }, { key: 'numbers.temp_c' }] as never, steps: [] };
    expect(decideSave({ mode: 'edit', locked: true, diff: both, noteChanged: true })).toBe('new-version');
  });

  it('always makes the next version from "new version", locked or not', () => {
    for (const locked of [false, true]) {
      expect(decideSave({ mode: 'new-version', locked, diff: field('numbers.dose_g'), noteChanged: false })).toBe(
        'new-version',
      );
    }
  });
});

describe('changeSummary', () => {
  it('says how many fields changed', () => {
    expect(changeSummary(0)).toBe('No changes yet');
    expect(changeSummary(1)).toBe('1 field changed');
    expect(changeSummary(3)).toBe('3 fields changed');
  });
});
