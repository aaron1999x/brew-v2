'use client';

import { useEffect, useRef } from 'react';
import {
  Label,
  Slider as AriaSlider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from 'react-aria-components';
import sliderStyles from '@/components/ui/Slider/Slider.module.css';
import { cx } from '@/lib/cx';
import styles from './TasteSlider.module.css';

type Props = Readonly<{
  /** The input's id, so the error summary can focus it. */
  id: string;
  label: string;
  /** 0–10 in half steps, or null while empty. */
  value: number | null;
  onChange: (value: number) => void;
  isInvalid?: boolean;
  errorMessage?: string;
}>;

const format = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Keys that move a slider by a step or more: the first one sets 5.0 instead. */
const STEP_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown']);

/**
 * The overall score: a slider from 0 to 10 in half steps that starts empty, with no thumb showing.
 * The first tap or drag scores it; with a keyboard the first arrow key sets 5.0 (Home and End set
 * 0 and 10). It is the one required score.
 */
export function OverallSlider({ id, label, value, onChange, isInvalid, errorMessage }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const empty = value == null;

  // The input's id (for the error summary's link) and the phrase a screen reader says for the value.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.id = id;
    input.setAttribute('aria-valuetext', empty ? 'not scored' : `${format.format(value)} out of 10`);
    input.setAttribute('aria-required', 'true');
    if (isInvalid) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }, [id, empty, value, isInvalid]);

  return (
    <div className={styles.row}>
      <AriaSlider
        className={sliderStyles.slider}
        value={value ?? 0}
        onChange={(next) => onChange(next as number)}
        minValue={0}
        maxValue={10}
        step={0.5}
        formatOptions={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
      >
        <div className={sliderStyles.header}>
          <Label className={sliderStyles.label}>
            {label}
            <span className={styles.required}> (required)</span>
          </Label>
          <SliderOutput className={sliderStyles.output}>
            {({ state }) => <span className="num">{empty ? 'Not scored' : state.getThumbValueLabel(0)}</span>}
          </SliderOutput>
        </div>
        <div
          onKeyDownCapture={(event) => {
            if (!empty) return;
            if (STEP_KEYS.has(event.key)) onChange(5);
            else if (event.key === 'Home') onChange(0);
            else if (event.key === 'End') onChange(10);
            else return;
            event.preventDefault();
            event.stopPropagation();
          }}
          // A first touch or click scores it: the track then moves the value to where it was pressed.
          onPointerDownCapture={() => {
            if (empty) onChange(0);
          }}
        >
          <SliderTrack className={sliderStyles.track}>
            {({ state }) => (
              <>
                <div className={sliderStyles.rail} />
                {empty ? null : (
                  <div className={sliderStyles.fill} style={{ width: `${state.getThumbPercent(0) * 100}%` }} />
                )}
                <SliderThumb
                  inputRef={inputRef}
                  className={cx(sliderStyles.thumb, empty && styles.hidden)}
                  data-primary-control=""
                />
              </>
            )}
          </SliderTrack>
        </div>
      </AriaSlider>
      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
    </div>
  );
}
