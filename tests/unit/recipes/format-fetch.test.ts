import { describe, expect, it } from 'vitest';
import {
  fetchRecipeBySlug,
  parseVersionNo,
  toVersionRow,
  versionByNo,
  type VersionRow,
} from '@/lib/recipes/fetch';
import { formatRange, formatRoastDate } from '@/lib/recipes/format';

describe('formatRoastDate', () => {
  it('shows the calendar date it was given, in any time zone', () => {
    expect(formatRoastDate('2026-11-19', 'en-GB')).toBe('19 Nov 2026');
    expect(formatRoastDate('2026-01-01', 'en-US')).toBe('Jan 1, 2026');
  });

  it('returns text it cannot read as it is', () => {
    expect(formatRoastDate('soon')).toBe('soon');
  });
});

describe('formatRange', () => {
  const f = (n: number) => `${n}!`;
  it('handles both, one and neither end', () => {
    expect(formatRange(1, 2, f)).toBe('1! to 2!');
    expect(formatRange(2, 2, f)).toBe('2!');
    expect(formatRange(null, 3, f)).toBe('3!');
    expect(formatRange(4, null, f)).toBe('4!');
    expect(formatRange(null, null, f)).toBeNull();
  });
});

describe('toVersionRow', () => {
  it('types the JSON columns and tolerates bad ones', () => {
    const row = { steps: [{ id: 'a' }], gear: { brewer: { name: 'V60' } } };
    expect(toVersionRow(row as never)).toMatchObject({ steps: [{ id: 'a' }], gear: { brewer: { name: 'V60' } } });
    expect(toVersionRow({ steps: {}, gear: [] } as never)).toMatchObject({ steps: [], gear: {} });
  });
});

describe('versionByNo and parseVersionNo', () => {
  const versions = [{ version_no: 3 }, { version_no: 2 }, { version_no: 1 }] as VersionRow[];

  it('finds a version by number, the latest without one, and nothing for a missing number', () => {
    expect(versionByNo(versions, 2)?.version_no).toBe(2);
    expect(versionByNo(versions, null)?.version_no).toBe(3);
    expect(versionByNo(versions, 9)).toBeNull();
    expect(versionByNo([], null)).toBeNull();
  });

  it('reads only whole version numbers from a URL', () => {
    expect(parseVersionNo('3')).toBe(3);
    expect(parseVersionNo(['4', '5'])).toBe(4);
    for (const bad of ['0', '-1', '2.5', 'x', '', '1e3', '0003', undefined, null]) {
      expect(parseVersionNo(bad as string | undefined)).toBeNull();
    }
  });
});

/** A just-enough fake of the supabase query builder: every table answers with its one result. */
function fakeClient(results: Record<string, { data: unknown; error?: unknown }>) {
  const chain = (table: string) => {
    const result = { data: results[table]?.data ?? null, error: results[table]?.error ?? null };
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is']) q[m] = () => q;
    q.maybeSingle = () => Promise.resolve(result);
    // The versions list is awaited after `order`.
    q.order = () => Promise.resolve(result);
    return q;
  };
  return { from: chain } as never;
}

describe('fetchRecipeBySlug', () => {
  const profile = { data: { id: 'u1', handle: 'aaron' } };
  const recipe = { data: { id: 'r1', slug: 'v60', latest_version_id: 'v2', owner_id: 'u1' } };
  const version = {
    data: [
      { id: 'v2', version_no: 2, steps: [], gear: {} },
      { id: 'v1', version_no: 1, steps: [], gear: {} },
    ],
  };

  it('returns the recipe with its latest version and every version, newest first', async () => {
    const found = await fetchRecipeBySlug(
      fakeClient({ profiles: profile, recipes: recipe, recipe_versions: version }),
      'Aaron',
      'v60',
    );
    expect(found?.recipe.id).toBe('r1');
    expect(found?.version.id).toBe('v2');
    expect(found?.versions.map((v) => v.version_no)).toEqual([2, 1]);
    expect(found?.owner).toEqual({ id: 'u1', handle: 'aaron' });
  });

  it('returns null for a recipe with no versions', async () => {
    expect(
      await fetchRecipeBySlug(
        fakeClient({ profiles: profile, recipes: recipe, recipe_versions: { data: [] } }),
        'aaron',
        'v60',
      ),
    ).toBeNull();
  });

  it('returns null when the handle or the recipe is missing or hidden', async () => {
    expect(await fetchRecipeBySlug(fakeClient({}), 'x', 'y')).toBeNull();
    expect(await fetchRecipeBySlug(fakeClient({ profiles: profile }), 'aaron', 'y')).toBeNull();
  });

  it('throws on a real failure, so it is not mistaken for "not available"', async () => {
    await expect(
      fetchRecipeBySlug(fakeClient({ profiles: { data: null, error: new Error('down') } }), 'a', 'b'),
    ).rejects.toThrow('down');
  });
});
