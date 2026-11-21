import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TypedNumberField } from '@/components/ui/NumberField/TypedNumberField';
import { emptyDraft, fieldId, parseDraft, type RecipeDraft } from '@/lib/recipes/draft';
import { NUMBER_HELP } from '@/lib/recipes/schema';
import { numberToText, parseTypedNumber } from '@/lib/ui/typedNumber';

describe('parseTypedNumber: reads the text, never refuses it', () => {
  it('reads whole numbers, decimals and a decimal comma', () => {
    expect(parseTypedNumber('750')).toEqual({ kind: 'number', value: 750 });
    expect(parseTypedNumber('7.5')).toEqual({ kind: 'number', value: 7.5 });
    expect(parseTypedNumber('7,5')).toEqual({ kind: 'number', value: 7.5 });
    expect(parseTypedNumber(' 7.5 ')).toEqual({ kind: 'number', value: 7.5 });
    expect(parseTypedNumber('.5')).toEqual({ kind: 'number', value: 0.5 });
    expect(parseTypedNumber('7.')).toEqual({ kind: 'number', value: 7 });
    expect(parseTypedNumber('-3')).toEqual({ kind: 'number', value: -3 });
  });

  it('says empty for nothing, and invalid for anything that is not a number', () => {
    expect(parseTypedNumber('')).toEqual({ kind: 'empty' });
    expect(parseTypedNumber('   ')).toEqual({ kind: 'empty' });
    for (const text of ['abc', '7.5.0', '2.5.0', '1e3', '7 5', '1,2,3', '--3', '.', ',', '7a', '24 clicks']) {
      expect(parseTypedNumber(text), text).toEqual({ kind: 'invalid' });
    }
  });

  it('turns a stored number back into text', () => {
    expect(numberToText(750)).toBe('750');
    expect(numberToText(7.5)).toBe('7.5');
    expect(numberToText(null)).toBe('');
    expect(numberToText(Number.NaN)).toBe('');
  });
});

describe('saving reports text in a number field', () => {
  const filled = (over: Partial<RecipeDraft> = {}): RecipeDraft => ({
    ...emptyDraft(),
    name: 'Morning V60',
    method: 'pour_over',
    dose_g: 15,
    brew_water_g: 250,
    ...over,
  });
  const errorsOf = (draft: RecipeDraft) => {
    const parsed = parseDraft(draft);
    return parsed.ok ? [] : parsed.errors;
  };

  it('a number that is not whole says so, in the same words as unreadable text', () => {
    expect(errorsOf(filled({ grind_microns: 7.5 }))).toEqual([
      { fieldId: fieldId('grind_microns'), message: 'Use whole microns, e.g. 750' },
    ]);
    expect(errorsOf(filled({ typed: { grind_microns: 'abc' } }))).toEqual([
      { fieldId: fieldId('grind_microns'), message: 'Use whole microns, e.g. 750' },
    ]);
  });

  it('unreadable text blocks saving even though the number is empty, and names the field', () => {
    for (const key of Object.keys(NUMBER_HELP) as (keyof typeof NUMBER_HELP)[]) {
      const errors = errorsOf(filled({ typed: { [key]: 'x1' } }));
      expect(errors, key).toEqual([{ fieldId: fieldId(key), message: NUMBER_HELP[key] }]);
    }
  });

  it('every whole-number field has its own wording', () => {
    expect(NUMBER_HELP.altitude_m).toBe('Use whole metres, e.g. 1800');
    expect(NUMBER_HELP.grind_microns).toBe('Use whole microns, e.g. 750');
    expect(NUMBER_HELP.water_ppm).toBe('Use whole ppm, e.g. 75');
    expect(errorsOf(filled({ altitude_m: 1800.5 }))[0]?.message).toBe(NUMBER_HELP.altitude_m);
    expect(errorsOf(filled({ water_ppm: 7.5 }))[0]?.message).toBe(NUMBER_HELP.water_ppm);
  });

  it('both problems in one form are listed once each, text first', () => {
    const errors = errorsOf(filled({ name: '', typed: { grind_microns: 'abc' } }));
    expect(errors.map((e) => e.fieldId).sort()).toEqual([fieldId('grind_microns'), fieldId('name')].sort());
  });

  it('a readable whole number is fine, and an old saved draft without the typed map still opens', () => {
    expect(errorsOf(filled({ grind_microns: 750 }))).toEqual([]);
    const old = { ...filled() } as Partial<RecipeDraft>;
    delete old.typed;
    expect(parseDraft({ ...emptyDraft(), ...old } as RecipeDraft).ok).toBe(true);
  });
});

function Harness({ onChange }: { onChange: (value: number | null, typed?: string) => void }) {
  const [state, setState] = useState<{ value: number | null; typed?: string }>({ value: null });
  return (
    <TypedNumberField
      label="Particle size (µm)"
      description="Optional. Whole microns, e.g. 750"
      value={state.value}
      typed={state.typed}
      error={undefined}
      onChange={(value, typed) => {
        setState({ value, typed });
        onChange(value, typed);
      }}
    />
  );
}

describe('TypedNumberField', () => {
  it('lets everything be typed and keeps the text as typed, including a decimal point', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('Particle size (µm)');
    await userEvent.setup().type(input, '7.5');
    expect(input).toHaveValue('7.5');
    expect(onChange).toHaveBeenLastCalledWith(7.5, undefined);
  });

  it('keeps letters and symbols too, and reports the text instead of a number', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('Particle size (µm)');
    await userEvent.setup().type(input, 'a1b.2.3');
    expect(input).toHaveValue('a1b.2.3');
    expect(onChange).toHaveBeenLastCalledWith(null, 'a1b.2.3');
  });

  it('reports null when emptied, and accepts a decimal comma', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('Particle size (µm)');
    const user = userEvent.setup();
    await user.type(input, '7,5');
    expect(onChange).toHaveBeenLastCalledWith(7.5, undefined);
    await user.clear(input);
    expect(onChange).toHaveBeenLastCalledWith(null, undefined);
  });

  it('is a plain text input with the decimal keypad, a hint and no autocorrect', () => {
    render(<Harness onChange={vi.fn()} />);
    const input = screen.getByLabelText('Particle size (µm)');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(screen.getByText('Optional. Whole microns, e.g. 750')).toBeInTheDocument();
  });

  it('shows the text it was given when the draft already holds unreadable text', () => {
    render(
      <TypedNumberField label="Altitude (metres)" value={null} typed="about 1800" onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText('Altitude (metres)')).toHaveValue('about 1800');
  });

  it('shows the form’s message when there is one', () => {
    render(
      <TypedNumberField
        label="Altitude (metres)"
        value={1800.5}
        error="Use whole metres, e.g. 1800"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Altitude (metres)')).toBeInvalid();
    expect(screen.getByText('Use whole metres, e.g. 1800')).toBeInTheDocument();
  });

  it('follows a change from outside, but not while the text already means the same', async () => {
    const { rerender } = render(<TypedNumberField label="Size" value={650} onChange={vi.fn()} />);
    const input = screen.getByLabelText('Size');
    expect(input).toHaveValue('650');
    rerender(<TypedNumberField label="Size" value={700} onChange={vi.fn()} />);
    expect(input).toHaveValue('700');
    rerender(<TypedNumberField label="Size" value={null} onChange={vi.fn()} />);
    expect(input).toHaveValue('');
  });
});
