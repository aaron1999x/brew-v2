'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Label,
  Slider as AriaSlider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from 'react-aria-components';
import styles from './Slider.module.css';

export type SliderProps = {
  label: string;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** Taste scores are 0–10 in half steps. */
  minValue?: number;
  maxValue?: number;
  step?: number;
  isDisabled?: boolean;
  name?: string;
};

const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export function Slider({
  label,
  value,
  defaultValue = 0,
  onChange,
  minValue = 0,
  maxValue = 10,
  step = 0.5,
  isDisabled,
  name,
}: SliderProps) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const inputRef = useRef<HTMLInputElement>(null);

  // VoiceOver reads aria-valuetext, so give it the full phrase ("7.5 out of 10").
  useEffect(() => {
    inputRef.current?.setAttribute(
      'aria-valuetext',
      `${format.format(current)} out of ${format.format(maxValue)}`,
    );
  }, [current, maxValue]);

  return (
    <AriaSlider
      className={styles.slider}
      value={current}
      onChange={(next) => {
        setInner(next as number);
        onChange?.(next as number);
      }}
      minValue={minValue}
      maxValue={maxValue}
      step={step}
      isDisabled={isDisabled}
      formatOptions={{ maximumFractionDigits: 1 }}
    >
      <div className={styles.header}>
        <Label className={styles.label}>{label}</Label>
        <SliderOutput className={styles.output}>
          {({ state }) => (
            <>
              <span className="num">{state.getThumbValueLabel(0)}</span>
              <span className={styles.max}> / {format.format(maxValue)}</span>
            </>
          )}
        </SliderOutput>
      </div>
      <SliderTrack className={styles.track}>
        {({ state }) => (
          <>
            <div className={styles.rail} />
            <div className={styles.fill} style={{ width: `${state.getThumbPercent(0) * 100}%` }} />
            <SliderThumb
              inputRef={inputRef}
              name={name}
              className={styles.thumb}
              data-primary-control=""
            />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}
