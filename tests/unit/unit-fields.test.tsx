import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/settings/useSettings', () => ({
  useUnits: () => ({ units: { temp_unit: 'c', weight_unit: 'g' } }),
}));

const { TemperatureField } = await import('@/components/ui/UnitFields/TemperatureField');
const { WeightField } = await import('@/components/ui/UnitFields/WeightField');

type Units = { temp_unit: 'c' | 'f'; weight_unit: 'g' | 'oz' };
const IMPERIAL: Units = { temp_unit: 'f', weight_unit: 'oz' };

function Harness({
  initialTemp = 93,
  initialWeight = 18,
  units = IMPERIAL,
  onTemp,
  onWeight,
}: {
  initialTemp?: number | null;
  initialWeight?: number | null;
  units?: Units;
  onTemp?: (v: number | null) => void;
  onWeight?: (v: number | null) => void;
}) {
  const [temp, setTemp] = useState(initialTemp);
  const [weight, setWeight] = useState(initialWeight);
  return (
    <>
      <TemperatureField
        label="Temperature"
        value={temp}
        units={units}
        onChange={(v) => {
          setTemp(v);
          onTemp?.(v);
        }}
      />
      <WeightField
        label="Dose"
        value={weight}
        units={units}
        onChange={(v) => {
          setWeight(v);
          onWeight?.(v);
        }}
      />
      <output data-testid="stored">{`${temp}|${weight}`}</output>
    </>
  );
}

describe('TemperatureField and WeightField', () => {
  it('show the stored metric value in the user unit with its label', () => {
    render(<Harness />);
    expect(screen.getByLabelText(/Temperature/)).toHaveValue('199.4');
    expect(screen.getByLabelText(/Dose/)).toHaveValue('0.63');
    expect(screen.getByText('°F')).toBeInTheDocument();
    expect(screen.getByText('oz')).toBeInTheDocument();
  });

  it('show metric as it is stored', () => {
    render(<Harness units={{ temp_unit: 'c', weight_unit: 'g' }} />);
    expect(screen.getByLabelText(/Temperature/)).toHaveValue('93');
    expect(screen.getByLabelText(/Dose/)).toHaveValue('18');
  });

  it('never write back a value the person did not edit', async () => {
    const onTemp = vi.fn();
    const onWeight = vi.fn();
    render(<Harness onTemp={onTemp} onWeight={onWeight} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/Temperature/));
    await user.tab();
    await user.click(screen.getByLabelText(/Dose/));
    await user.tab();
    expect(onTemp).not.toHaveBeenCalled();
    expect(onWeight).not.toHaveBeenCalled();
    expect(screen.getByTestId('stored')).toHaveTextContent('93|18');
  });

  it('convert a typed value to metric', async () => {
    const onTemp = vi.fn();
    render(<Harness onTemp={onTemp} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText(/Temperature/);
    await user.clear(input);
    await user.type(input, '200');
    await user.tab();
    expect(onTemp).toHaveBeenLastCalledWith(93.3);
  });

  it('report a cleared field as null', async () => {
    const onWeight = vi.fn();
    render(<Harness onWeight={onWeight} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/Dose/));
    await user.tab();
    expect(onWeight).toHaveBeenLastCalledWith(null);
  });
});
