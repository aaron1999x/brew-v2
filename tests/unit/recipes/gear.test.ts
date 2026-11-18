import { describe, expect, it } from 'vitest';
import {
  buildGear,
  catalogMatches,
  choiceToEntry,
  defaultGearSelection,
  gearDisplayName,
  gearPickerOrder,
  gearRealName,
  selectionFromSnapshot,
  type GearItem,
} from '@/lib/recipes/gear';

const V60 = { id: '11111111-1111-4111-8111-111111111111', name: 'Hario V60 02' };
const C40 = { id: '22222222-2222-4222-8222-222222222222', name: 'Comandante C40 MK4' };

const item = (over: Partial<GearItem> & Pick<GearItem, 'id' | 'category'>): GearItem => ({
  catalog_id: null,
  custom_name: null,
  nickname: null,
  notes: null,
  is_default: false,
  catalog: null,
  ...over,
});

const brewer = item({
  id: 'b1',
  category: 'brewer',
  catalog_id: V60.id,
  catalog: V60,
  is_default: true,
});
const grinder = item({
  id: 'g1',
  category: 'grinder',
  custom_name: 'Hand grinder',
  nickname: 'Old faithful',
  is_default: true,
});
const kettle = item({ id: 'k1', category: 'kettle', custom_name: 'Stovetop kettle' });

describe('gear names', () => {
  it('shows the nickname, else the catalogue name, else the custom name', () => {
    expect(gearDisplayName(grinder)).toBe('Old faithful');
    expect(gearDisplayName(brewer)).toBe('Hario V60 02');
    expect(gearDisplayName(kettle)).toBe('Stovetop kettle');
    expect(gearDisplayName({ ...brewer, nickname: 'Kitchen V60' })).toBe('Kitchen V60');
  });

  it('ignores a blank nickname', () => {
    expect(gearDisplayName({ ...kettle, nickname: '   ' })).toBe('Stovetop kettle');
  });

  it('the real name is the catalogue name, else the custom name, never the nickname', () => {
    expect(gearRealName({ ...brewer, nickname: 'Kitchen V60' } as GearItem)).toBe('Hario V60 02');
    expect(gearRealName(grinder)).toBe('Hand grinder');
  });
});

describe('gear snapshot', () => {
  it('never contains a nickname', () => {
    const { gear } = buildGear({
      brewer: { kind: 'item', item: { ...brewer, nickname: 'Kitchen V60' } },
      grinder: { kind: 'item', item: grinder },
    });
    expect(gear.grinder).toEqual({ item_id: 'g1', name: 'Hand grinder' });
    expect(gear.brewer).toEqual({ item_id: 'b1', catalog_id: V60.id, name: 'Hario V60 02' });
    expect(JSON.stringify(gear)).not.toMatch(/Old faithful|Kitchen V60|nickname/);
  });

  it('records catalogue picks, free text and kept entries', () => {
    const { gear } = buildGear({
      grinder: { kind: 'catalog', catalog: C40 },
      kettle: { kind: 'text', text: '  Gooseneck from the market ' },
      scale: { kind: 'snapshot', entry: { item_id: 'gone', name: 'Old scale' } },
      filter: { kind: 'text', text: '   ' },
      water: null,
    });
    expect(gear).toEqual({
      grinder: { catalog_id: C40.id, name: 'Comandante C40 MK4' },
      kettle: { name: 'Gooseneck from the market' },
      scale: { item_id: 'gone', name: 'Old scale' },
    });
  });

  it('fills the brewer and grinder catalogue columns when known', () => {
    const built = buildGear({
      brewer: { kind: 'item', item: brewer },
      grinder: { kind: 'catalog', catalog: C40 },
    });
    expect(built.brewer_catalog_id).toBe(V60.id);
    expect(built.grinder_catalog_id).toBe(C40.id);
  });

  it('leaves the catalogue columns null for custom items and free text', () => {
    const built = buildGear({
      brewer: { kind: 'text', text: 'Homemade dripper' },
      grinder: { kind: 'item', item: grinder },
    });
    expect(built.brewer_catalog_id).toBeNull();
    expect(built.grinder_catalog_id).toBeNull();
    expect(buildGear({})).toEqual({ gear: {}, brewer_catalog_id: null, grinder_catalog_id: null });
  });

  it('skips an item with no usable name', () => {
    expect(choiceToEntry({ kind: 'item', item: item({ id: 'x', category: 'other' }) })).toBeNull();
  });
});

describe('defaults and pre-fill', () => {
  it('a new recipe starts with my default in each category', () => {
    const selection = defaultGearSelection([brewer, grinder, kettle]);
    expect(selection.brewer).toEqual({ kind: 'item', item: brewer });
    expect(selection.grinder).toEqual({ kind: 'item', item: grinder });
    expect(selection.kettle).toBeUndefined();
    expect(buildGear(selection).gear.grinder?.name).toBe('Hand grinder');
  });

  it('has nothing to pre-fill without defaults', () => {
    expect(defaultGearSelection([])).toEqual({});
    expect(defaultGearSelection([kettle])).toEqual({});
  });

  it('ignores a default in the "other" category', () => {
    expect(
      defaultGearSelection([
        item({ id: 'o', category: 'other', custom_name: 'Thing', is_default: true }),
      ]),
    ).toEqual({});
  });

  it('a new version starts from the version it came from, not from today’s defaults', () => {
    const saved = { grinder: { item_id: 'old-grinder', name: 'Comandante C40 MK4' } };
    const selection = selectionFromSnapshot(saved);
    expect(selection).toEqual({ grinder: { kind: 'snapshot', entry: saved.grinder } });
    // Today's defaults point somewhere else; the saved entry is kept exactly as it was.
    expect(buildGear(selection).gear).toEqual(saved);
    expect(defaultGearSelection([grinder]).grinder).not.toEqual(selection.grinder);
  });

  it('handles a missing snapshot', () => {
    expect(selectionFromSnapshot(null)).toEqual({});
    expect(selectionFromSnapshot(undefined)).toEqual({});
  });

  it('keeps a saved version unchanged when gear is renamed or deleted afterwards', () => {
    const { gear } = buildGear({ grinder: { kind: 'item', item: grinder } });
    const renamed = { ...grinder, custom_name: 'Renamed grinder' };
    expect(gearRealName(renamed)).toBe('Renamed grinder');
    expect(gear.grinder?.name).toBe('Hand grinder');
    expect(buildGear(selectionFromSnapshot(gear)).gear).toEqual(gear);
  });
});

describe('pickers', () => {
  it('lists my default first in a category', () => {
    const second = item({ id: 'b2', category: 'brewer', custom_name: 'Second brewer' });
    expect(gearPickerOrder([second, brewer, kettle], 'brewer').map((i) => i.id)).toEqual([
      'b1',
      'b2',
    ]);
    expect(gearPickerOrder([kettle], 'grinder')).toEqual([]);
  });

  it('matches catalogue rows on brand and model, any order, any case', () => {
    const row = { brand: 'Hario', model: 'V60 02' };
    expect(catalogMatches(row, 'v60')).toBe(true);
    expect(catalogMatches(row, 'hario 02')).toBe(true);
    expect(catalogMatches(row, '02 HARIO')).toBe(true);
    expect(catalogMatches(row, 'kalita')).toBe(false);
    expect(catalogMatches(row, '   ')).toBe(true);
  });
});
