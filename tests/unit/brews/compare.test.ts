import { describe, expect, it } from 'vitest';
import {
  attributeScores,
  buildCompareRows,
  comparePathFor,
  parseCompareIds,
  type CompareBrew,
  type CompareFormat,
} from '@/lib/brews/compare';

const fmt: CompareFormat = {
  weight: (g) => `${g} g`,
  temp: (c) => `${c} °C`,
  duration: (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
  dateTime: (iso) => iso.slice(0, 10),
};

const brew = (over: Partial<CompareBrew> = {}): CompareBrew => ({
  id: '11111111-1111-4111-8111-111111111111',
  recipe_name_snapshot: 'Morning V60',
  version_no_snapshot: 1,
  brewed_at: '2026-11-20T08:00:00Z',
  dose_g_snapshot: 15,
  drawdown_s: 170,
  beverage_g: 212,
  tds_pct: 1.4,
  ey_pct: 19.8,
  sweetness: 7,
  acidity: 6.5,
  brightness: 6,
  body: 7.5,
  clarity: 8,
  balance: 7,
  aftertaste: 6.5,
  overall: 8.5,
  flavours: ['peach'],
  version: { brew_water_g: 250, temp_c: 93, grind_setting: '7.5' },
  ...over,
});

const find = (rows: ReturnType<typeof buildCompareRows>, label: string) => rows.find((r) => r.label === label)!;

describe('buildCompareRows', () => {
  const a = brew();
  const b = brew({
    id: '22222222-2222-4222-8222-222222222222',
    brewed_at: '2026-11-21T08:00:00Z',
    overall: 7,
    sweetness: 6,
    flavours: ['peach', 'cocoa'],
    version: { brew_water_g: 250, temp_c: 94, grind_setting: '7.5' },
  });
  const rows = buildCompareRows([a, b], fmt);

  it('groups setup, results and sensory, with overall as its own row after the seven attributes', () => {
    expect(rows.map((r) => r.group)).toEqual([
      ...Array(6).fill('Setup'),
      ...Array(5).fill('Results'),
      ...Array(9).fill('Sensory'),
    ]);
    const sensory = rows.filter((r) => r.group === 'Sensory').map((r) => r.label);
    expect(sensory).toEqual([
      'Sweetness',
      'Acidity',
      'Brightness',
      'Body',
      'Clarity',
      'Balance',
      'Aftertaste',
      'Overall',
      'Flavours',
    ]);
  });

  it('marks only the rows whose shown values differ', () => {
    const differing = rows.filter((r) => r.differs).map((r) => r.label);
    expect(differing).toEqual(['Brewed at', 'Temperature', 'Sweetness', 'Overall', 'Flavours']);
    expect(find(rows, 'Overall').values).toEqual(['8.5', '7.0']);
    expect(find(rows, 'Temperature').values).toEqual(['93 °C', '94 °C']);
  });

  it('shows a dash for what is missing, and still works when the version is gone', () => {
    const gone = buildCompareRows(
      [a, brew({ id: '3', version: null, drawdown_s: null, tds_pct: null, ey_pct: null, sweetness: null })],
      fmt,
    );
    expect(find(gone, 'Brew water').values).toEqual(['250 g', '—']);
    expect(find(gone, 'Brew ratio').values).toEqual(['1:16.7', '—']);
    expect(find(gone, 'Drawdown').values).toEqual(['2:50', '—']);
    expect(find(gone, 'Sweetness').values).toEqual(['7.0', '—']);
  });

  it('works with three brews and the attribute scores are the seven radar axes', () => {
    expect(buildCompareRows([a, b, a], fmt)[0]!.values).toHaveLength(3);
    expect(attributeScores(a)).toEqual([7, 6.5, 6, 7.5, 8, 7, 6.5]);
  });
});

describe('compare ids', () => {
  const x = '11111111-1111-4111-8111-111111111111';
  const y = '22222222-2222-4222-8222-222222222222';
  const z = '33333333-3333-4333-8333-333333333333';
  const w = '44444444-4444-4444-8444-444444444444';

  it('keeps up to three distinct valid ids in order and drops the rest', () => {
    expect(parseCompareIds(`${x},${y},${z},${w}`)).toEqual([x, y, z]);
    expect(parseCompareIds(`${x},${x},nope,${y}`)).toEqual([x, y]);
    expect(parseCompareIds(undefined)).toEqual([]);
    expect(parseCompareIds('')).toEqual([]);
  });

  it('builds the link', () => {
    expect(comparePathFor([x, y])).toBe(`/brews/compare?ids=${x},${y}`);
  });
});
