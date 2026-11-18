import { describe, expect, it } from 'vitest';
import { buildGearInput, customItemLabel, missingPickMessage, pickFromItem } from '@/lib/gear/form';
import type { GearItem } from '@/lib/recipes/gear';

const CAT = '11111111-1111-4111-8111-111111111111';

const base = { category: 'grinder' as const, typed: '', nickname: '', notes: '' };

const item = (over: Partial<GearItem>): GearItem => ({
  id: 'i1',
  category: 'grinder',
  catalog_id: null,
  custom_name: null,
  nickname: null,
  notes: null,
  is_default: false,
  catalog: null,
  ...over,
});

describe('buildGearInput', () => {
  it('saves a catalogue pick with no custom name', () => {
    const r = buildGearInput({ ...base, pick: { kind: 'catalog', id: CAT } });
    expect(r).toEqual({
      ok: true,
      input: {
        category: 'grinder',
        catalog_id: CAT,
        custom_name: null,
        nickname: null,
        notes: null,
      },
    });
  });

  it('saves a custom name with trimmed nickname and notes (empty text becomes null)', () => {
    const r = buildGearInput({
      ...base,
      pick: { kind: 'custom', text: '  Hand grinder ' },
      nickname: ' Old faithful ',
      notes: '   ',
    });
    expect(r).toEqual({
      ok: true,
      input: {
        category: 'grinder',
        catalog_id: null,
        custom_name: 'Hand grinder',
        nickname: 'Old faithful',
        notes: null,
      },
    });
  });

  it('asks for a choice when nothing was picked, and says what to do with typed text', () => {
    const none = buildGearInput({ ...base, pick: null });
    expect(none).toEqual({
      ok: false,
      errors: [{ field: 'item', message: 'Search for an item, or type your own name for it.' }],
    });
    const typed = buildGearInput({ ...base, pick: null, typed: 'Weird grinder' });
    expect(typed.ok).toBe(false);
    if (!typed.ok) {
      expect(typed.errors[0]!.field).toBe('item');
      expect(typed.errors[0]!.message).toContain('Use “Weird grinder” as a custom item');
    }
  });

  it('enforces the limits: custom name 80, nickname 40, notes 500', () => {
    const long = (n: number) => 'x'.repeat(n);
    expect(buildGearInput({ ...base, pick: { kind: 'custom', text: long(81) } })).toMatchObject({
      ok: false,
      errors: [{ field: 'item' }],
    });
    expect(buildGearInput({ ...base, pick: { kind: 'custom', text: long(80) } }).ok).toBe(true);
    const nick = buildGearInput({
      ...base,
      pick: { kind: 'custom', text: 'a' },
      nickname: long(41),
    });
    expect(nick).toMatchObject({ ok: false, errors: [{ field: 'nickname' }] });
    const notes = buildGearInput({
      ...base,
      pick: { kind: 'custom', text: 'a' },
      notes: long(501),
    });
    expect(notes).toMatchObject({ ok: false, errors: [{ field: 'notes' }] });
    expect(
      buildGearInput({ ...base, pick: { kind: 'custom', text: 'a' }, notes: long(500) }).ok,
    ).toBe(true);
  });

  it('reports a blank custom name as the item field', () => {
    expect(buildGearInput({ ...base, pick: { kind: 'custom', text: '   ' } })).toMatchObject({
      ok: false,
      errors: [{ field: 'item' }],
    });
  });
});

describe('picks', () => {
  it('starts from the catalogue row, else the custom name, else nothing', () => {
    expect(pickFromItem(item({ catalog_id: CAT }))).toEqual({ kind: 'catalog', id: CAT });
    expect(pickFromItem(item({ custom_name: 'Mine' }))).toEqual({ kind: 'custom', text: 'Mine' });
    expect(pickFromItem(null)).toBeNull();
    expect(pickFromItem(item({}))).toBeNull();
  });

  it('words the custom option as in the design', () => {
    expect(customItemLabel('Hand grinder')).toBe('Use “Hand grinder” as a custom item');
    expect(missingPickMessage('  ')).toBe('Search for an item, or type your own name for it.');
  });
});
