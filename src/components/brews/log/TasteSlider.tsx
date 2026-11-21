'use client';

import { useEffect, useRef } from 'react';
import {
  Label,
  Slider as AriaSlider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from 'react-aria-components';
import { Button } from '@/components/ui/Button/Button';
import sliderStyles from '@/components/ui/Slider/Slider.module.css';
import { cx } from '@/lib/cx';
import styles from './TasteSlider.module.css';

type Props = Readonly<{
  /** The input's id, so the error summary can focus it. */
  id: string;
  label: string;
  /** 0–10 in half steps, or null while not scored. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** The overall score is the one required score. */
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
}>;

const format = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Keys that move a slider by a step or more: the first one sets 5.0 instead. */
const STEP_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown']);

/**
 * A taste score from 0 to 10 in half steps that starts "Not scored" (hollow thumb). The first tap or
 * drag sets a value; with a keyboard the first arrow key sets 5.0 and Home and End set 0 and 10.
 * Clear puts it back to not scored.
 */
export function TasteSlider({ id, label, value, onChange, isRequired, isInvalid, errorMessage }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const unscored = value == null;

  // The input's id (for the error summary's link) and the phrase a screen reader says for the value.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.id = id;
    input.setAttribute('aria-valuetext', unscored ? 'not scored' : `${format.format(value)} out of 10`);
    if (isInvalid) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }, [id, unscored, value, isInvalid]);

  return (
    <div className={styles.row} data-unscored={unscored ? '' : undefined}>
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
            {isRequired ? <span className={styles.required}> (required)</span> : null}
          </Label>
          <SliderOutput className={sliderStyles.output}>
            {({ state }) => (
              <span className="num">{unscored ? 'Not scored' : state.getThumbValueLabel(0)}</span>
            )}
          </SliderOutput>
        </div>
        <div
          onKeyDownCapture={(event) => {
            if (!unscored) return;
            if (STEP_KEYS.has(event.key)) onChange(5);
            else if (event.key === 'Home') onChange(0);
            else if (event.key === 'End') onChange(10);
            else return;
            event.preventDefault();
            event.stopPropagation();
          }}
          // A first touch or click scores it: the track then moves the value to where it was pressed.
          onPointerDownCapture={() => {
            if (unscored) onChange(0);
          }}
        >
          <SliderTrack className={sliderStyles.track}>
            {({ state }) => (
              <>
                <div className={sliderStyles.rail} />
                {unscored ? null : (
                  <div className={sliderStyles.fill} style={{ width: `${state.getThumbPercent(0) * 100}%` }} />
                )}
                <SliderThumb
                  inputRef={inputRef}
                  className={cx(sliderStyles.thumb, unscored && styles.hollow)}
                  data-primary-control=""
                />
              </>
            )}
          </SliderTrack>
        </div>
      </AriaSlider>
      <div className={styles.side}>
        {unscored ? null : (
          <Button variant="ghost" onPress={() => onChange(null)} aria-label={`Clear ${label}`}>
            Clear
          </Button>
        )}
      </div>
      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
    </div>
  );
}
