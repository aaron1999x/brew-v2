import { describe, expect, it, vi } from 'vitest';
import { DELETE_PHRASE, deleteAccount, type DeleteDeps } from '@/lib/account/deleteAccount';
import { buildExport, exportFileName, EXPORT_SCHEMA } from '@/lib/export/buildExport';
import { inviteMessage } from '@/lib/admin/useInvites';
import { passwordErrorField } from '@/components/account/ChangePasswordForm';

const user = { id: 'u-1', email: 'me@test.invalid' };

function deps(overrides: Partial<DeleteDeps> = {}): DeleteDeps {
  return {
    verifyPassword: vi.fn().mockResolvedValue('ok'),
    removeAvatarFiles: vi.fn().mockResolvedValue(undefined),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('deleteAccount', () => {
  it('checks the password, then removes the files, then the user, in that order', async () => {
    const order: string[] = [];
    const d = deps({
      verifyPassword: vi.fn(async () => {
        order.push('password');
        return 'ok' as const;
      }),
      removeAvatarFiles: vi.fn(async () => void order.push('files')),
      deleteUser: vi.fn(async () => void order.push('user')),
    });
    const result = await deleteAccount({ user, password: 'pw', confirm: DELETE_PHRASE }, d);
    expect(result).toEqual({ ok: true });
    expect(order).toEqual(['password', 'files', 'user']);
    expect(d.verifyPassword).toHaveBeenCalledWith('me@test.invalid', 'pw');
    expect(d.deleteUser).toHaveBeenCalledWith('u-1');
  });

  it.each([
    ['the phrase is not DELETE', { password: 'pw', confirm: 'delete' }],
    ['the phrase is missing', { password: 'pw', confirm: undefined }],
    ['the password is empty', { password: '', confirm: DELETE_PHRASE }],
    ['the password is not text', { password: 42, confirm: DELETE_PHRASE }],
  ])('deletes nothing when %s', async (_name, input) => {
    const d = deps();
    const result = await deleteAccount({ user, ...input }, d);
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(d.verifyPassword).not.toHaveBeenCalled();
    expect(d.deleteUser).not.toHaveBeenCalled();
  });

  it('deletes nothing for a wrong password', async () => {
    const d = deps({ verifyPassword: vi.fn().mockResolvedValue('wrong') });
    const result = await deleteAccount({ user, password: 'nope', confirm: DELETE_PHRASE }, d);
    expect(result).toEqual({ ok: false, status: 403, code: 'wrong_password' });
    expect(d.removeAvatarFiles).not.toHaveBeenCalled();
    expect(d.deleteUser).not.toHaveBeenCalled();
  });

  it('passes rate limiting through and does not delete', async () => {
    const d = deps({ verifyPassword: vi.fn().mockResolvedValue('rate_limited') });
    const result = await deleteAccount({ user, password: 'pw', confirm: DELETE_PHRASE }, d);
    expect(result).toEqual({ ok: false, status: 429, code: 'rate_limited' });
    expect(d.deleteUser).not.toHaveBeenCalled();
  });

  it('does not delete the user when the files could not be removed', async () => {
    const d = deps({ removeAvatarFiles: vi.fn().mockRejectedValue(new Error('storage down')) });
    const result = await deleteAccount({ user, password: 'pw', confirm: DELETE_PHRASE }, d);
    expect(result).toEqual({ ok: false, status: 500, code: 'delete_failed' });
    expect(d.deleteUser).not.toHaveBeenCalled();
  });
});

/** A tiny stand-in for the Supabase query builder: records filters and returns canned rows. */
function fakeClient(tables: Record<string, Record<string, unknown>[]>) {
  const calls: { table: string; filters: [string, unknown][] }[] = [];
  const from = (table: string) => {
    const call = { table, filters: [] as [string, unknown][] };
    calls.push(call);
    const rows = () => tables[table] ?? [];
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = chain;
    builder.order = chain;
    builder.eq = (column: string, value: unknown) => {
      call.filters.push([column, value]);
      return builder;
    };
    builder.in = (column: string, values: unknown[]) => {
      call.filters.push([column, values]);
      return builder;
    };
    builder.range = (from: number, to: number) => {
      const eq = call.filters.filter(([, v]) => !Array.isArray(v));
      const inn = call.filters.filter(([, v]) => Array.isArray(v));
      const matching = rows().filter(
        (r) =>
          eq.every(([c, v]) => r[c] === v) &&
          inn.every(([c, v]) => (v as unknown[]).includes(r[c])),
      );
      return Promise.resolve({ data: matching.slice(from, to + 1), error: null });
    };
    builder.maybeSingle = () => {
      const eq = call.filters.find(([, v]) => !Array.isArray(v));
      const row = rows().find((r) => (eq ? r[eq[0]] === eq[1] : true)) ?? null;
      return Promise.resolve({ data: row, error: null });
    };
    return builder;
  };
  return { client: { from } as never, calls };
}

describe('buildExport', () => {
  const tables = {
    profiles: [
      { id: 'u-1', handle: 'me' },
      { id: 'u-2', handle: 'someone_else' },
    ],
    user_settings: [{ user_id: 'u-1', temp_unit: 'c' }],
    account_status: [
      { user_id: 'u-1', role: 'member', suspended_at: null, suspended_reason: null },
    ],
    gear_items: [
      { id: 'g1', user_id: 'u-1' },
      { id: 'g2', user_id: 'u-2' },
    ],
    recipes: [
      { id: 'r1', owner_id: 'u-1', visibility: 'private' },
      { id: 'r2', owner_id: 'u-2', visibility: 'public' },
    ],
    recipe_versions: [
      { id: 'v2', recipe_id: 'r1', version_no: 2 },
      { id: 'v1', recipe_id: 'r1', version_no: 1 },
      { id: 'v9', recipe_id: 'r2', version_no: 1 },
    ],
    brews: [
      { id: 'b1', user_id: 'u-1' },
      { id: 'b2', user_id: 'u-2' },
    ],
    saved_recipes: [
      { recipe_id: 'r2', user_id: 'u-1' },
      { recipe_id: 'r1', user_id: 'u-2' },
    ],
    notifications: [{ id: 'n1', user_id: 'u-2' }],
  };

  it('has the agreed shape', async () => {
    const { client } = fakeClient(tables);
    const now = new Date('2026-11-14T10:00:00Z');
    const out = await buildExport(
      client,
      { id: 'u-1', email: 'me@test.invalid', created_at: '2026-01-01T00:00:00Z' },
      now,
    );
    expect(Object.keys(out)).toEqual([
      'schema',
      'exported_at',
      'account',
      'profile',
      'settings',
      'gear',
      'recipes',
      'brews',
      'saved',
      'notifications',
    ]);
    expect(out.schema).toBe(EXPORT_SCHEMA);
    expect(out.exported_at).toBe('2026-11-14T10:00:00.000Z');
    expect(out.account).toEqual({
      email: 'me@test.invalid',
      created_at: '2026-01-01T00:00:00Z',
      role: 'member',
    });
    expect(out.recipes[0]!.versions.map((v) => v.version_no)).toEqual([1, 2]);
    expect(exportFileName(now)).toBe('brew-data-2026-11-14.json');
  });

  it("includes only the user's own rows, nothing belonging to anyone else", async () => {
    const { client } = fakeClient(tables);
    const out = await buildExport(client, { id: 'u-1', email: 'me@test.invalid' });
    const text = JSON.stringify(out);
    expect(out.profile).toEqual({ id: 'u-1', handle: 'me' });
    expect(out.gear.map((g) => g.id)).toEqual(['g1']);
    expect(out.recipes.map((r) => r.id)).toEqual(['r1']);
    expect(out.brews.map((b) => b.id)).toEqual(['b1']);
    expect(out.saved).toEqual([{ recipe_id: 'r2', user_id: 'u-1' }]);
    expect(out.notifications).toEqual([]);
    for (const other of ['u-2', 'someone_else', 'v9', 'g2', 'b2']) {
      expect(text).not.toContain(other);
    }
  });

  it('reads past the 1000-row page limit', async () => {
    const many = Array.from({ length: 2300 }, (_, i) => ({ id: `b${i}`, user_id: 'u-1' }));
    const { client } = fakeClient({ ...tables, brews: many });
    const out = await buildExport(client, { id: 'u-1' });
    expect(out.brews).toHaveLength(2300);
  });
});

describe('account helpers', () => {
  it('sends a password error to the right field', () => {
    expect(passwordErrorField('current_password_invalid')).toBe('current');
    expect(passwordErrorField('invalid_credentials')).toBe('current');
    expect(passwordErrorField('reauthentication_not_valid')).toBe('current');
    expect(passwordErrorField('same_password')).toBe('next');
    expect(passwordErrorField('weak_password')).toBe('next');
    expect(passwordErrorField('over_request_rate_limit')).toBeNull();
    expect(passwordErrorField(undefined)).toBeNull();
  });

  it('puts the sign-up link in the invite message', () => {
    expect(inviteMessage('https://example.com')).toContain('https://example.com/signup');
  });
});
