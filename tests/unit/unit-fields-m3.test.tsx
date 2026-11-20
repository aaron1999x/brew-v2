import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/settings/useSettings', () => ({
  useUnits: () => ({ units: { temp_unit: 'c', weight_unit: 'g' } }),
}));

const { DurationField } = await import('@/components/ui/UnitFields/DurationField');
const { RateField } = await import('@/components/ui/UnitFields/RateField');

type Units = { temp_unit: 'c' | 'f'; weight_unit: 'g' | 'oz' };
const IMPERIAL: Units = { temp_unit: 'f', weight_unit: 'oz' };

function Duration({
  initial = 150 as number | null,
  onChange,
  ...rest
}: {
  initial?: number | null;
  onChange?: (v: number | null) => void;
  isDisabled?: boolean;
  maxSeconds?: number;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DurationField
        label="Wait"
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
        {...rest}
      />
      <output data-testid="stored">{String(value)}</output>
    </>
  );
}

describe('DurationField', () => {
  it('shows m:ss below an hour and h:mm:ss from one hour', () => {
    const { rerender } = render(<DurationField label="Wait" value={150} />);
    expect(screen.getByLabelText(/Wait/)).toHaveValue('2:30');
    rerender(<DurationField label="Wait" value={43_200} />);
    expect(screen.getByLabelText(/Wait/)).toHaveValue('12:00:00');
  });

  it('takes a 12-hour steep and reports seconds', async () => {
    const onChange = vi.fn();
    render(<Duration initial={null} onChange={onChange} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Wait/), '12:00:00');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(43_200);
    expect(screen.getByLabelText(/Wait/)).toHaveValue('12:00:00');
    expect(screen.getByTestId('stored')).toHaveTextContent('43200');
  });

  it('never writes back a value the person did not edit', async () => {
    const onChange = vi.fn();
    render(<Duration initial={43_200} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/Wait/));
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('stored')).toHaveTextContent('43200');
  });

  it('shows an error for a time over 48 hours, and says the limit', async () => {
    render(<Duration initial={null} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Wait/), '49:00:00');
    await user.tab();
    expect(screen.getByLabelText(/Wait/)).toBeInvalid();
    expect(screen.getByText('Enter a time up to 48:00:00')).toBeInTheDocument();
  });

  it('accepts exactly 48 hours', async () => {
    render(<Duration initial={null} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Wait/), '48:00:00');
    await user.tab();
    expect(screen.getByLabelText(/Wait/)).not.toBeInvalid();
  });

  it('uses a custom limit', async () => {
    render(<Duration initial={null} maxSeconds={600} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Wait/), '11:00');
    await user.tab();
    expect(screen.getByText('Enter a time up to 10:00')).toBeInTheDocument();
  });

  it('flags text that is not a time', async () => {
    render(<Duration initial={null} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Wait/), '1:75');
    await user.tab();
    expect(screen.getByLabelText(/Wait/)).toBeInvalid();
  });

  it('can be disabled and cleared', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Duration initial={90} isDisabled />);
    expect(screen.getByLabelText(/Wait/)).toBeDisabled();
    rerender(<Duration initial={90} onChange={onChange} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/Wait/));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

function Rate({
  initial = 3.5 as number | null,
  units = IMPERIAL,
  onChange,
}: {
  initial?: number | null;
  units?: Units;
  onChange?: (v: number | null) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <RateField
        label="Rate"
        value={value}
        units={units}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
      <output data-testid="stored">{String(value)}</output>
    </>
  );
}

describe('RateField', () => {
  it('shows g/s as stored and oz/s in imperial', () => {
    const { unmount } = render(<Rate units={{ temp_unit: 'c', weight_unit: 'g' }} />);
    expect(screen.getByLabelText(/Rate/)).toHaveValue('3.5');
    expect(screen.getByText('g/s')).toBeInTheDocument();
    unmount();
    render(<Rate />);
    expect(screen.getByLabelText(/Rate/)).toHaveValue('0.123');
    expect(screen.getByText('oz/s')).toBeInTheDocument();
  });

  it('never writes back a value the person did not edit (no oz/s round-trip drift)', async () => {
    const onChange = vi.fn();
    render(<Rate onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/Rate/));
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('stored')).toHaveTextContent('3.5');
  });

  it('converts a typed oz/s value to g/s', async () => {
    const onChange = vi.fn();
    render(<Rate onChange={onChange} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText(/Rate/);
    await user.clear(input);
    await user.type(input, '0.1');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(2.83);
  });

  it('reports a cleared field as null', async () => {
    const onChange = vi.fn();
    render(<Rate onChange={onChange} units={{ temp_unit: 'c', weight_unit: 'g' }} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/Rate/));
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
