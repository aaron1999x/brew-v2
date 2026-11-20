import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecipeGearPicker } from '@/components/recipes/editor/RecipeGearPicker';
import type { CatalogEntry, GearChoice, GearItem } from '@/lib/recipes/gear';

const catalog: CatalogEntry[] = [
  { id: 'v60', category: 'brewer', brand: 'Hario', model: 'V60 02', name: 'Hario V60 02' },
  { id: 'wave', category: 'brewer', brand: 'Kalita', model: 'Wave 185', name: 'Kalita Wave 185' },
  { id: 'april', category: 'brewer', brand: 'April', model: 'Brewer', name: 'April Brewer' },
  { id: 'c40', category: 'grinder', brand: 'Comandante', model: 'C40', name: 'Comandante C40' },
];

const item = (over: Partial<GearItem>): GearItem => ({
  id: 'i1',
  category: 'brewer',
  catalog_id: null,
  custom_name: null,
  nickname: null,
  notes: null,
  is_default: false,
  catalog: null,
  ...over,
});

const myGear: GearItem[] = [
  item({
    id: 'mine-april',
    catalog_id: 'april',
    catalog: { id: 'april', name: 'April Brewer' },
    is_default: true,
  }),
  item({ id: 'mine-custom', custom_name: 'Stone dripper', nickname: 'Morning dripper' }),
  item({ id: 'mine-grinder', category: 'grinder', custom_name: 'Hand grinder' }),
];

function setup(props: Partial<Parameters<typeof RecipeGearPicker>[0]> = {}) {
  const onChange = vi.fn<(choice: GearChoice | null) => void>();
  render(
    <RecipeGearPicker
      id="recipe-gear-brewer"
      label="Brewer"
      category="brewer"
      myGear={myGear}
      catalog={catalog}
      value={null}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, user: userEvent.setup() };
}

describe('RecipeGearPicker', () => {
  it('lists my gear first and the catalogue after it, each under its own heading', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /show brewer/i }));
    const mine = await screen.findByRole('group', { name: 'My gear' });
    const cat = screen.getByRole('group', { name: 'Catalogue' });
    expect(within(mine).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'April BrewerDefault',
      'Morning dripper',
    ]);
    expect(within(cat).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Hario V60 02',
      'Kalita Wave 185',
    ]);
  });

  it('does not list a catalogue model I already own a second time', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /show brewer/i }));
    await screen.findByRole('group', { name: 'Catalogue' });
    expect(screen.getAllByRole('option', { name: /April Brewer/ })).toHaveLength(1);
  });

  it('only lists the category it is for', async () => {
    const { user } = setup({ category: 'grinder', label: 'Grinder' });
    await user.click(screen.getByRole('button', { name: /show grinder/i }));
    await screen.findByRole('group', { name: 'My gear' });
    expect(screen.getByRole('option', { name: 'Hand grinder' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Comandante C40' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /V60/ })).toBeNull();
  });

  it('picks the highlighted row from the keyboard: type, ArrowDown, Enter', async () => {
    const { user, onChange } = setup();
    const input = screen.getByRole('combobox', { name: 'Brewer' });
    await user.type(input, 'kalita');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'catalog',
      catalog: { id: 'wave', name: 'Kalita Wave 185' },
    });
    expect(input).toHaveValue('Kalita Wave 185');
  });

  it('picks one of my items and keeps its real name for the recipe', async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole('button', { name: /show brewer/i }));
    await user.click(await screen.findByRole('option', { name: 'Morning dripper' }));
    const choice = onChange.mock.calls.at(-1)![0];
    expect(choice).toMatchObject({ kind: 'item', item: { id: 'mine-custom' } });
  });

  it('counts a name typed by hand straight away', async () => {
    const { user, onChange } = setup();
    await user.type(screen.getByRole('combobox', { name: 'Brewer' }), 'Clever');
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'text', text: 'Clever' });
  });

  it('says it takes your own name, like the other gear pickers', () => {
    setup();
    expect(screen.getByRole('combobox', { name: 'Brewer' })).toHaveAttribute(
      'placeholder',
      'Search by brand or model, or type your own.',
    );
    expect(screen.getByText('Not listed? Type its name to add it as your own.')).toBeInTheDocument();
  });

  it('opens with every row when a default is already filled in', async () => {
    const { user } = setup({ value: { kind: 'item', item: myGear[0]! } });
    const input = screen.getByRole('combobox', { name: 'Brewer' });
    expect(input).toHaveValue('April Brewer');
    await user.click(screen.getByRole('button', { name: /show brewer/i }));
    expect(await screen.findAllByRole('option')).toHaveLength(4);
  });
});
