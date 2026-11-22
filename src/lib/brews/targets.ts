/** Where a measured value falls against a version's target range. */
export type TargetStatus = 'in' | 'below' | 'above';

export const TARGET_STATUS_LABEL: Record<TargetStatus, string> = {
  in: 'In range',
  below: 'Below',
  above: 'Above',
};

/**
 * Compares a measured value with a target range. Either end can be missing (an open-ended
 * target); with no value or no target at all there is nothing to say, so the result is null.
 */
export function evaluateTarget(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): TargetStatus | null {
  if (value == null || !Number.isFinite(value)) return null;
  const lo = min != null && Number.isFinite(min) ? min : null;
  const hi = max != null && Number.isFinite(max) ? max : null;
  if (lo == null && hi == null) return null;
  if (lo != null && value < lo) return 'below';
  if (hi != null && value > hi) return 'above';
  return 'in';
}

/** "19–21%", "19% or more", "up to 21%": the range in words, with the caller's value formatter. */
export function targetRangeText(
  min: number | null | undefined,
  max: number | null | undefined,
  format: (n: number) => string,
): string | null {
  if (min != null && max != null) return min === max ? format(min) : `${format(min)}–${format(max)}`;
  if (min != null) return `${format(min)} or more`;
  if (max != null) return `up to ${format(max)}`;
  return null;
}
