import { render, screen } from '@testing-library/react';
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
});
