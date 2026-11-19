import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GearPicker } from '@/components/gear/GearPicker';
import { FormErrorSummary } from '@/components/ui/FormErrorSummary/FormErrorSummary';
import type { GearPick } from '@/lib/gear/form';
import type { CatalogEntry } from '@/lib/recipes/gear';

const catalog: CatalogEntry[] = [
  { id: 'v60', category: 'brewer', brand: 'Hario', model: 'V60 02', name: 'Hario V60 02' },
  { id: 'wave', category: 'brewer', brand: 'Kalita', model: 'Wave 185', name: 'Kalita Wave 185' },
  {
    id: 'c40',
    category: 'grinder',
    brand: 'Comandante',
    model: 'C40 MK4',
    name: 'Comandante C40 MK4',
  },
];

function setup(props: Partial<Parameters<typeof GearPicker>[0]> = {}) {
  const onChange = vi.fn<(pick: GearPick | null) => void>();
  const onTextChange = vi.fn<(text: string) => void>();
  render(
    <GearPicker
      id="gear-item"
      label="Item"
      category="brewer"
      catalog={catalog}
      value={null}
      onChange={onChange}
      onTextChange={onTextChange}
      {...props}
    />,
  );
  return { onChange, onTextChange, user: userEvent.setup() };
}

describe('GearPicker', () => {
  it('lists only the chosen category and filters on brand and model', async () => {
    const { user } = setup();
    await user.type(screen.getByRole('combobox', { name: /Item/ }), 'kal');
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Kalita Wave 185',
      expect.stringContaining('Use “kal” as a custom item'),
    ]);
    expect(screen.queryByRole('option', { name: 'Comandante C40 MK4' })).toBeNull();
  });

  it('reports a catalogue pick', async () => {
    const { user, onChange } = setup();
    await user.type(screen.getByRole('combobox', { name: /Item/ }), 'v60');
    await user.click(await screen.findByRole('option', { name: 'Hario V60 02' }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'catalog', id: 'v60' });
    expect(screen.getByRole('combobox', { name: /Item/ })).toHaveValue('Hario V60 02');
  });

  it('picks the highlighted row from the keyboard: type, ArrowDown, Enter', async () => {
    const { user, onChange } = setup();
    const input = screen.getByRole('combobox', { name: /Item/ });
    await user.type(input, 'v60 02');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'catalog', id: 'v60' });
    expect(input).toHaveValue('Hario V60 02');
  });

  it('has no "use what I typed" row while results are still loading, so Enter cannot pick it', async () => {
    const { user, onChange } = setup({ isLoading: true, catalog: [] });
    const input = screen.getByRole('combobox', { name: /Item/ });
    await user.type(input, 'v60 02');
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Loading…']);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).not.toHaveBeenCalledWith({ kind: 'custom', text: 'v60 02' });
  });

  it('offers the typed text as a custom item, last in the list', async () => {
    const { user, onChange } = setup({ category: 'grinder' });
    await user.type(screen.getByRole('combobox', { name: /Item/ }), 'Hand grinder');
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Use “Hand grinder” as a custom item');
    await user.click(options[0]!);
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'custom', text: 'Hand grinder' });
  });

  it('puts the custom option after real matches', async () => {
    const { user } = setup({ category: 'grinder' });
    await user.type(screen.getByRole('combobox', { name: /Item/ }), 'comandante');
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Comandante C40 MK4',
      expect.stringContaining('as a custom item'),
    ]);
  });

  it('tells the form what is typed, so an unmade choice can be explained', async () => {
    const { user, onTextChange } = setup();
    await user.type(screen.getByRole('combobox', { name: /Item/ }), 'ab');
    expect(onTextChange).toHaveBeenLastCalledWith('ab');
  });

  it('reports no pick when a pick is typed over', async () => {
    const { user, onChange } = setup({ value: { kind: 'catalog', id: 'v60' } });
    const input = screen.getByRole('combobox', { name: /Item/ });
    expect(input).toHaveValue('Hario V60 02');
    await user.type(input, 'x');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('starts with a custom name already in the input', () => {
    setup({ category: 'grinder', value: { kind: 'custom', text: 'Hand grinder' } });
    expect(screen.getByRole('combobox', { name: /Item/ })).toHaveValue('Hand grinder');
  });

  it('shows its error under the field', () => {
    setup({ errorMessage: 'Search for an item, or type your own name for it.' });
    expect(
      screen.getByText('Search for an item, or type your own name for it.'),
    ).toBeInTheDocument();
  });

  it('is the target of an error-summary link: focus lands on the search input', async () => {
    const user = userEvent.setup();
    render(
      <>
        <FormErrorSummary errors={[{ fieldId: 'gear-item', message: 'Pick something' }]} />
        <GearPicker
          id="gear-item"
          label="Item"
          category="brewer"
          catalog={catalog}
          value={null}
          onChange={() => undefined}
        />
      </>,
    );
    await user.click(screen.getByRole('link', { name: 'Pick something' }));
    expect(screen.getByRole('combobox', { name: /Item/ })).toHaveFocus();
  });
});

describe('GearPicker after a custom pick', () => {
  it('closes the list, so the rest of the form is reachable again', async () => {
    const user = userEvent.setup();
    render(
      <>
        <GearPicker
          id="gear-item"
          label="Item"
          category="grinder"
          catalog={catalog}
          value={null}
          onChange={() => undefined}
        />
        <button type="button">Save</button>
      </>,
    );
    await user.type(screen.getByRole('combobox', { name: /Item/ }), 'Hand grinder');
    await user.click(await screen.findByRole('option', { name: /as a custom item/ }));
    expect(screen.queryByRole('listbox')).toBeNull();
    // Nothing is hidden from assistive technology behind an open list.
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: /Item/ })).toHaveValue('Hand grinder');
  });

  it('forgets the custom pick when the text is edited', async () => {
    const onChange = vi.fn<(pick: GearPick | null) => void>();
    const user = userEvent.setup();
    render(
      <GearPicker
        id="gear-item"
        label="Item"
        category="grinder"
        catalog={catalog}
        value={null}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('combobox', { name: /Item/ });
    await user.type(input, 'Hand grinder');
    await user.click(await screen.findByRole('option', { name: /as a custom item/ }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'custom', text: 'Hand grinder' });
    await user.type(input, 's');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
