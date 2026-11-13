'use client';

import {
  Label,
  Radio,
  RadioGroup as AriaRadioGroup,
  type RadioGroupProps as AriaRadioGroupProps,
} from 'react-aria-components';
import { cx } from '@/lib/cx';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import styles from './SegmentedControl.module.css';

export type Segment = { value: string; label: string; isDisabled?: boolean };

export type SegmentedControlProps = Omit<
  AriaRadioGroupProps,
  'className' | 'style' | 'children' | 'orientation'
> & {
  /** Names the group for assistive technology; shown above the control unless `hideLabel`. */
  label: string;
  hideLabel?: boolean;
  segments: readonly Segment[];
};

/**
 * Pick one of a few. Built on a radio group (not toggle buttons) so it has a group label, a form
 * value and arrow-key selection for free. Left/Right (and Up/Down) move and select.
 */
export function SegmentedControl({
  label,
  hideLabel = false,
  segments,
  ...rest
}: SegmentedControlProps) {
  return (
    <AriaRadioGroup {...rest} orientation="horizontal" className={styles.group}>
      {hideLabel ? (
        <Label>
          <VisuallyHidden>{label}</VisuallyHidden>
        </Label>
      ) : (
        <Label className={styles.label}>{label}</Label>
      )}
      <div className={styles.segments}>
        {segments.map((s) => (
          <Radio
            key={s.value}
            value={s.value}
            isDisabled={s.isDisabled}
            className={cx(styles.segment)}
            data-primary-control=""
          >
            {s.label}
          </Radio>
        ))}
      </div>
    </AriaRadioGroup>
  );
}
