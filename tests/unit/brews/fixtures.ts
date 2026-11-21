import fixtureFile from '@/lib/recipes/__fixtures__/methods.json';
import type { QuickChangeBase } from '@/lib/brews/quick-change';
import type { StepData } from '@/lib/recipes/steps';

/** A 6-step V60 (bloom, swirl, three pours, swirl, last pour) with a per-pour temperature. */
export const V60_STEPS: StepData[] = [
  { id: 's1', kind: 'pour', at_s: 0, target_g: 30, temp_c: 93, technique: 'Bloom' },
  { id: 's2', kind: 'swirl', at_s: 10, duration_s: 5 },
  { id: 's3', kind: 'pour', at_s: 45, target_g: 100, temp_c: 93 },
  { id: 's4', kind: 'pour', at_s: 75, target_g: 170, temp_c: 93 },
  { id: 's5', kind: 'swirl', at_s: 100, duration_s: 5 },
  { id: 's6', kind: 'pour', at_s: 110, target_g: 250, temp_c: 93 },
];

export type V60Base = QuickChangeBase & { bypass_g: number; name: string };

export const V60: V60Base = {
  name: 'V60 everyday',
  dose_g: 15,
  brew_water_g: 250,
  bypass_g: 0,
  temp_c: 93,
  grind_setting: '18',
  steps: V60_STEPS,
};

/** Steps of one of the M3 method fixtures (v60, switch, aeropress, french_press, cold_brew). */
export function methodSteps(key: string): StepData[] {
  const fixture = fixtureFile.fixtures.find((f) => f.key === key);
  if (!fixture) throw new Error(`no fixture ${key}`);
  return fixture.version.steps as unknown as StepData[];
}

export const METRIC = { temp_unit: 'c', weight_unit: 'g' } as const;
export const IMPERIAL = { temp_unit: 'f', weight_unit: 'oz' } as const;

/** Deep-freezes a value so a test fails if the code under test mutates it. */
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
