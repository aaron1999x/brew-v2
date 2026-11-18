'use client';

import { DURATION_MAX_S } from '@/lib/units';
import { TimeInput, type TimeInputProps } from '../TimeInput/TimeInput';

export type DurationFieldProps = TimeInputProps;

/**
 * A step time or duration: `m:ss`, switching to `h:mm:ss` from one hour (so a 12-hour cold-brew
 * steep reads 12:00:00). Takes and emits seconds, 0 to 48 h by default, and only calls `onChange`
 * when the person types: focusing or leaving the field never rewrites the stored value.
 */
export function DurationField({ maxSeconds = DURATION_MAX_S, ...props }: DurationFieldProps) {
  return <TimeInput {...props} maxSeconds={maxSeconds} />;
}
