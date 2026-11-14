import type { TempUnit, WeightUnit } from './types';

const G_PER_OZ = 28.349523125;

export const cToF = (c: number): number => (c * 9) / 5 + 32;
export const fToC = (f: number): number => ((f - 32) * 5) / 9;
export const gToOz = (g: number): number => g / G_PER_OZ;
export const ozToG = (oz: number): number => oz * G_PER_OZ;

/** Digits shown after the decimal point (at most). Temperatures: 1. Grams: 1. Ounces: 2. */
export const TEMP_DECIMALS = 1;
export const WEIGHT_DECIMALS: Record<WeightUnit, number> = { g: 1, oz: 2 };

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  // Number.EPSILON nudges 1.005-style halves up, so 1.005 becomes 1.01 rather than 1.
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** A stored °C value as a number in the user's unit, rounded for display (no unit label). */
export function tempToDisplay(celsius: number, unit: TempUnit): number {
  return roundTo(unit === 'f' ? cToF(celsius) : celsius, TEMP_DECIMALS);
}

/** A stored gram value as a number in the user's unit, rounded for display. */
export function weightToDisplay(grams: number, unit: WeightUnit): number {
  return roundTo(unit === 'oz' ? gToOz(grams) : grams, WEIGHT_DECIMALS[unit]);
}

/**
 * What a person typed in their unit, as a stored metric value. Temperatures are stored to 0.1 °C
 * (200 °F is stored as 93.3 °C); weights to 0.01 g.
 */
export function tempFromDisplay(value: number, unit: TempUnit): number {
  return roundTo(unit === 'f' ? fToC(value) : value, 1);
}

export function weightFromDisplay(value: number, unit: WeightUnit): number {
  return roundTo(unit === 'oz' ? ozToG(value) : value, 2);
}

/** Parses typed text ("93", "93,5", "200 °F") into a number, or null. Does not convert units. */
export function parseNumber(text: string): number | null {
  const cleaned = text
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/[°a-zA-Z]+$/, '');
  if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
