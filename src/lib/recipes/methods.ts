import type { Database } from '@/types/database';

type Enums = Database['public']['Enums'];

export type BrewMethod = Enums['brew_method'];
export type RoastLevel = Enums['roast_level'];
export type BypassTiming = Enums['bypass_timing'];

/** In the order the method picker shows them. */
export const BREW_METHODS = [
  'pour_over',
  'immersion',
  'hybrid',
  'aeropress',
  'french_press',
  'siphon',
  'cold_brew',
  'other',
] as const satisfies readonly BrewMethod[];

export const METHOD_LABELS: Record<BrewMethod, string> = {
  pour_over: 'Pour-over',
  immersion: 'Immersion (Clever, steeper)',
  hybrid: 'Hybrid (Switch)',
  aeropress: 'AeroPress',
  french_press: 'French press',
  siphon: 'Siphon',
  cold_brew: 'Cold brew',
  other: 'Other',
};

/** Short label for lists and headings: a custom method shows the name the person gave it. */
export function methodLabel(method: BrewMethod, custom?: string | null): string {
  if (method === 'other') {
    const name = custom?.trim();
    return name ? name : METHOD_LABELS.other;
  }
  return METHOD_LABELS[method];
}

export const METHOD_CUSTOM_MAX = 40;

export const ROAST_LEVELS = [
  'light',
  'medium_light',
  'medium',
  'medium_dark',
  'dark',
] as const satisfies readonly RoastLevel[];

export const ROAST_LEVEL_LABELS: Record<RoastLevel, string> = {
  light: 'Light',
  medium_light: 'Medium-light',
  medium: 'Medium',
  medium_dark: 'Medium-dark',
  dark: 'Dark',
};

export const BYPASS_TIMINGS = [
  'none',
  'before',
  'after',
] as const satisfies readonly BypassTiming[];

export const BYPASS_TIMING_LABELS: Record<BypassTiming, string> = {
  none: 'None',
  before: 'Before brewing',
  after: 'After brewing',
};

/** Presets for the process combobox; free text is allowed too. */
export const PROCESS_PRESETS = [
  'Washed',
  'Natural',
  'Honey',
  'Anaerobic',
  'Carbonic maceration',
  'Wet-hulled',
  'Experimental',
] as const;

/** Presets for the roast colour scale combobox; free text is allowed too. */
export const COLOUR_SCALE_PRESETS = ['Agtron', 'Lighttells', 'Roast Vision', 'ColorTrack'] as const;
