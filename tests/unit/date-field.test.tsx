import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DateField } from '@/components/ui/DateField/DateField';

function Harness({ initial = null as string | null, onChange }: { initial?: string | null; onChange?: (v: string | null) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DateField
      label="Roast date"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe('DateField', () => {
  it('is labelled and shows the date it was given', () => {
    render(<Harness initial="2026-11-19" />);
    const field = screen.getByRole('group', { name: 'Roast date' });
    expect(field).toHaveTextContent('2026');
    expect(field).toHaveTextContent('19');
  });

  it('reports a plain YYYY-MM-DD once every part is typed, never a moment in time', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const segments = screen.getAllByRole('spinbutton');
    // Locale decides the order; fill each segment by its accessible name.
    for (const segment of segments) {
      const name = segment.getAttribute('aria-label') ?? '';
      await user.click(segment);
      if (/month/i.test(name)) await user.keyboard('11');
      else if (/day/i.test(name)) await user.keyboard('19');
      else if (/year/i.test(name)) await user.keyboard('2026');
    }
    expect(onChange).toHaveBeenLastCalledWith('2026-11-19');
  });

  it('shows an empty field for no date, and for text it cannot read', () => {
    const { rerender } = render(<DateField label="Roast date" value={null} onChange={() => {}} />);
    expect(screen.getAllByRole('spinbutton')[0]).toHaveAttribute('aria-valuetext', 'Empty');
    rerender(<DateField label="Roast date" value="not a date" onChange={() => {}} />);
    expect(screen.getAllByRole('spinbutton')[0]).toHaveAttribute('aria-valuetext', 'Empty');
  });
});
