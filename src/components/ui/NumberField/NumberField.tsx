'use client';

import { Minus, Plus } from 'lucide-react';
import {
  Button,
  Group,
  Input,
  NumberField as AriaNumberField,
  type NumberFieldProps as AriaNumberFieldProps,
} from 'react-aria-components';
import { cx } from '@/lib/cx';
import { FieldError, FieldHint, FieldLabel, fieldStyles, type FieldChrome } from '../Field/Field';
import { Icon } from '../Icon/Icon';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import styles from './NumberField.module.css';

export type Unit = 'g' | 'ml' | '°C' | '°F' | 's';

const unitNames: Record<Unit, string> = {
  g: 'grams',
  ml: 'millilitres',
  '°C': 'degrees Celsius',
  '°F': 'degrees Fahrenheit',
  s: 'seconds',
};

export type NumberFieldProps = Omit<AriaNumberFieldProps, 'className' | 'style' | 'children'> &
  FieldChrome & {
    /** Shown after the number and spoken in the field's description. */
    unit?: Unit;
    /** Adds − and + buttons. Off by default: brewers type numbers. */
    showStepper?: boolean;
  };

export function NumberField({
  label,
  description,
  errorMessage,
  unit,
  showStepper = false,
  ...rest
}: NumberFieldProps) {
  return (
    <AriaNumberField {...rest} className={fieldStyles.field}>
      <FieldLabel required={rest.isRequired}>{label}</FieldLabel>
      <Group className={cx(fieldStyles.control, styles.group)} data-primary-control="">
        {showStepper ? (
          <Button
            slot="decrement"
            className={styles.step}
            aria-label={`Decrease ${typeof label === 'string' ? label : ''}`.trim()}
          >
            <Icon icon={Minus} size="sm" />
          </Button>
        ) : null}
        <Input className={cx(fieldStyles.input, styles.number, 'num')} />
        {unit ? (
          <span aria-hidden="true" className={fieldStyles.suffix}>
            {unit}
          </span>
        ) : null}
        {showStepper ? (
          <Button
            slot="increment"
            className={styles.step}
            aria-label={`Increase ${typeof label === 'string' ? label : ''}`.trim()}
          >
            <Icon icon={Plus} size="sm" />
          </Button>
        ) : null}
      </Group>
      {description || unit ? (
        <FieldHint>
          {description}
          {unit ? <VisuallyHidden>{` Unit: ${unitNames[unit]}.`}</VisuallyHidden> : null}
        </FieldHint>
      ) : null}
      <FieldError>{errorMessage}</FieldError>
    </AriaNumberField>
  );
}
