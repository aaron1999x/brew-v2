import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { expect, signIn, test, waitForApp } from './helpers/test-users';

// Uses the staging secret key from the runner's environment and skips without it. Service workers
// are blocked: nothing here needs one.
test.use({ serviceWorkers: 'block' });

type FixtureStep = {
  id: string;
  kind: 'pour' | 'wait' | 'swirl' | 'stir' | 'press' | 'other';
  at_s: number;
  target_g?: number;
  duration_s?: number;
  label?: string;
  technique?: string;
};
type Fixture = {
  key: string;
  name: string;
  method: string;
  version: {
    dose_g: number;
    brew_water_g: number;
    temp_c?: number;
    bypass_g?: number;
    bypass_timing?: 'before' | 'after';
    drawdown_min_s?: number;
    drawdown_max_s?: number;
    gear: { brewer: { name: string } };
    steps: FixtureStep[];
  };
};

// The same five recipes the unit tests and the database tests use.
const fixtures: Fixture[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/lib/recipes/__fixtures__/methods.json'), 'utf8'),
).fixtures;

const METHOD_OPTION: Record<string, string> = {
  pour_over: 'Pour-over',
  hybrid: 'Hybrid (Switch)',
  aeropress: 'AeroPress',
  french_press: 'French press',
  cold_brew: 'Cold brew',
};
const KIND_BUTTON: Record<FixtureStep['kind'], string> = {
  pour: 'Pour',
  wait: 'Wait',
  swirl: 'Swirl',
  stir: 'Stir',
  press: 'Press',
  other: 'Other',
};

/** m:ss, then h:mm:ss from one hour: what a person types into a time field. */
function clock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** A number field commits on blur; check what it shows, so a missed keystroke fails right here. */
async function fillNumber(field: Locator, value: string) {
  await field.fill(value);
  await expect(field).toHaveValue(value);
  await field.blur();
  await expect(field).toHaveValue(value);
}

async function fillTime(field: Locator, seconds: number) {
  const text = clock(seconds);
  await field.fill(text);
  await field.blur();
  await expect(field).toHaveValue(text);
}

const step = (page: Page, n: number) => page.getByRole('group', { name: new RegExp(`^Step ${n},`) });

for (const fixture of fixtures) {
  test(`${fixture.key}: the recipe is created through the editor, field by field, with nothing lost`, async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, `method-${fixture.key}`);
    // Metric on screen, so what is typed is what is stored.
    await users.admin
      .from('user_settings')
      .update({ temp_unit: 'c', weight_unit: 'g' })
      .eq('user_id', user.id);
    await page.goto('/recipes/new');
    await waitForApp(page);

    const v = fixture.version;
    await page.getByLabel('Name').fill(fixture.name);
    await page.getByRole('button', { name: /Method$/ }).click();
    await page.getByRole('option', { name: METHOD_OPTION[fixture.method], exact: true }).click();

    // Gear: the catalogue's own brewer.
    const brewer = page.getByRole('combobox', { name: 'Brewer' });
    await brewer.click();
    await brewer.pressSequentially(v.gear.brewer.name);
    await page.getByRole('option', { name: v.gear.brewer.name, exact: true }).click();
    await expect(brewer).toHaveValue(v.gear.brewer.name);

    await fillNumber(page.getByLabel('Coffee dose'), String(v.dose_g));
    await fillNumber(page.getByLabel('Brew water'), String(v.brew_water_g));
    if (v.temp_c != null) await fillNumber(page.getByLabel('Water temperature'), String(v.temp_c));
    if (v.bypass_g) {
      await fillNumber(page.getByLabel('Bypass water'), String(v.bypass_g));
      await page.getByText(v.bypass_timing === 'after' ? 'After brewing' : 'Before brewing').click();
    }

    // Steps: add each one, then set exactly what the fixture says (including a 12-hour steep).
    for (const [i, s] of v.steps.entries()) {
      await page.getByRole('button', { name: KIND_BUTTON[s.kind], exact: true }).click();
      const card = step(page, i + 1);
      await expect(card).toBeVisible();
      await fillTime(card.getByLabel('Time'), s.at_s);
      if (s.kind === 'pour') {
        await fillNumber(card.getByLabel(/Scale reads after pouring/), String(s.target_g));
      } else if (s.kind === 'other') {
        await card.getByLabel('Label').fill(s.label!);
      }
      if (s.kind !== 'pour' && s.duration_s != null) {
        await fillTime(card.getByLabel('Duration (optional)'), s.duration_s);
      }
      if (s.technique) await card.getByLabel('Technique (optional)').fill(s.technique);
    }

    if (v.drawdown_min_s != null) {
      await page.getByLabel('Drawdown, shortest').fill(clock(v.drawdown_min_s));
      await page.getByLabel('Drawdown, longest').fill(clock(v.drawdown_max_s!));
    }

    await page.getByRole('button', { name: 'Save recipe' }).click();
    await page.waitForURL(`**/@${user.handle}/**`);
    await expect(page.getByRole('heading', { level: 1, name: fixture.name })).toBeVisible();

    // What was saved is what the fixture says: numbers, gear and every step.
    const { data: recipe } = await users.admin
      .from('recipes')
      .select('name, method, latest_version_id')
      .eq('owner_id', user.id)
      .single();
    expect(recipe).toMatchObject({ name: fixture.name, method: fixture.method });
    const { data: saved } = await users.admin
      .from('recipe_versions')
      .select('*')
      .eq('id', recipe!.latest_version_id)
      .single();
    expect(saved).toMatchObject({
      dose_g: v.dose_g,
      brew_water_g: v.brew_water_g,
      temp_c: v.temp_c ?? null,
      bypass_g: v.bypass_g ?? 0,
      bypass_timing: v.bypass_timing ?? 'none',
      drawdown_min_s: v.drawdown_min_s ?? null,
      drawdown_max_s: v.drawdown_max_s ?? null,
      gear: { brewer: { name: v.gear.brewer.name } },
    });
    const withoutIds = (steps: Array<Record<string, unknown>>) =>
      steps.map((s) => Object.fromEntries(Object.entries(s).filter(([key]) => key !== 'id')));
    expect(withoutIds(saved!.steps as Array<Record<string, unknown>>)).toEqual(
      withoutIds(v.steps as unknown as Array<Record<string, unknown>>),
    );

    // The page shows the last step's time: for cold brew that is 12 hours, never "720:00".
    const last = v.steps.at(-1)!;
    const steps = page.getByRole('region', { name: 'Steps' });
    await expect(steps.getByText(clock(last.at_s), { exact: true })).toBeVisible();
    if (fixture.key === 'cold_brew') {
      await expect(steps.getByText('for 12:00:00')).toBeVisible();
      await expect(page.locator('main').getByText('720:00')).toHaveCount(0);
    }
  });
}
