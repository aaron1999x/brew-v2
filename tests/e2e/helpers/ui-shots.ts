import type { Page } from '@playwright/test';
import { stubDevice } from './brew-device';
import { baseVersion, createRecipe, saveNextVersion } from './recipes';
import { expect, waitForApp, type TestUser, type TestUsers } from './test-users';

/**
 * The screens the `ui-reviewer` subagent can photograph. Add an entry when a stage adds or changes a
 * screen: `open` leaves the page showing the screen (with realistic data) and returns when it is ready.
 * `prototype` names the prototype file the screen follows (aaron1999x/Brew-Recipe), or null.
 */
export type ShotContext = { page: Page; users: TestUsers; user: TestUser };
export type ShotScreen = {
  prototype: string | null;
  open: (ctx: ShotContext) => Promise<void>;
};

const TARGETS = { tds_min: 1.3, tds_max: 1.5, ey_min: 19, ey_max: 21 };

async function recipeWithBrew(ctx: ShotContext) {
  const recipe = await createRecipe(ctx.users, ctx.user, 'Morning V60', {
    version: {
      ...TARGETS,
      grind_setting: '7.5',
      gear: { brewer: { name: 'Hario V60 02' }, grinder: { name: '1Zpresso K-Ultra' } },
    },
  });
  return recipe;
}

async function logBrew(ctx: ShotContext, versionId: string, over: Record<string, unknown> = {}) {
  const client = await ctx.users.clientFor(ctx.user);
  const { data, error } = await client.rpc('log_brew', {
    p_brew: {
      id: crypto.randomUUID(),
      recipe_version_id: versionId,
      brewed_at: new Date(Date.now() - 3_600_000).toISOString(),
      source: 'manual',
      overall: 8.5,
      sweetness: 7,
      acidity: 6.5,
      brightness: 6,
      body: 7.5,
      clarity: 8,
      balance: 7,
      aftertaste: 6.5,
      flavours: ['peach', 'floral', 'toasted almond'],
      tasted_temp: 'warm',
      notes: 'Sweet and clean, with a long finish.',
      next_change: 'Grind a touch finer',
      drawdown_s: 172,
      beverage_g: 212,
      tds_pct: 1.4,
      ...over,
    } as never,
  });
  expect(error).toBeNull();
  return (data as { id: string }).id;
}

export const SHOT_SCREENS: Record<string, ShotScreen> = {
  'brew-log': {
    prototype: 'src/pages/Brews.tsx',
    open: async (ctx) => {
      const { page, user } = ctx;
      const recipe = await recipeWithBrew(ctx);
      await page.goto(`/@${user.handle}/${recipe.slug}?brew=1`);
      await waitForApp(page);
      await page
        .getByRole('dialog', { name: 'Brew this recipe' })
        .getByRole('button', { name: 'Log only' })
        .click();
      await page.waitForURL('**/brews/new?session=*');
      await expect(page.getByRole('img', { name: /^Taste\./ })).toBeVisible();
      // Filled in the way a real log is.
      const overall = page.getByRole('slider', { name: /^Overall/ });
      await overall.focus();
      for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
      await page.getByLabel('Beverage weight').fill('212');
      await page.getByLabel('Beverage weight').blur();
      await page.getByLabel('TDS (%)').fill('1.4');
      await page.getByLabel('Drawdown').fill('2:52');
      await page.getByLabel('Drawdown').blur();
      await page.getByRole('row', { name: 'peach' }).click();
      await page.getByRole('row', { name: 'floral' }).click();
      await page.getByRole('button', { name: 'Warm' }).click();
    },
  },
  'brew-detail': {
    prototype: 'src/pages/Brews.tsx',
    open: async (ctx) => {
      const recipe = await recipeWithBrew(ctx);
      const id = await logBrew(ctx, recipe.v1Id);
      await ctx.page.goto(`/brews/${id}`);
      await waitForApp(ctx.page);
      await expect(ctx.page.getByRole('img', { name: /^Taste\./ })).toBeVisible();
    },
  },
  recipe: {
    prototype: 'src/components/SpecView.tsx',
    open: async (ctx) => {
      const recipe = await recipeWithBrew(ctx);
      await logBrew(ctx, recipe.v1Id);
      await ctx.page.goto(`/@${ctx.user.handle}/${recipe.slug}`);
      await waitForApp(ctx.page);
      await expect(ctx.page.getByRole('img', { name: /^Pour curve\./ })).toBeVisible();
      await expect(ctx.page.getByRole('heading', { name: 'My brews' })).toBeVisible();
    },
  },
  editor: {
    prototype: 'src/components/SpecEditor.tsx',
    open: async (ctx) => {
      const recipe = await recipeWithBrew(ctx);
      await ctx.page.goto(`/@${ctx.user.handle}/${recipe.slug}/edit?v=1`);
      await waitForApp(ctx.page);
      await expect(ctx.page.getByRole('heading', { level: 1, name: /Edit/ })).toBeVisible();
    },
  },
  compare: {
    prototype: null,
    open: async (ctx) => {
      const recipe = await recipeWithBrew(ctx);
      await saveNextVersion(
        ctx.users,
        ctx.user,
        recipe,
        baseVersion({ ...TARGETS, temp_c: 92, change_note: 'cooler' }),
      );
      await ctx.page.goto(`/@${ctx.user.handle}/${recipe.slug}/compare`);
      await waitForApp(ctx.page);
      await expect(ctx.page.getByRole('heading', { level: 1 })).toBeVisible();
    },
  },
  home: {
    prototype: 'src/pages/Dashboard.tsx',
    open: async (ctx) => {
      const recipe = await recipeWithBrew(ctx);
      await logBrew(ctx, recipe.v1Id);
      await logBrew(ctx, recipe.v1Id, {
        overall: 7,
        brewed_at: new Date(Date.now() - 86_400_000).toISOString(),
      });
      await ctx.page.goto('/home');
      await waitForApp(ctx.page);
      await expect(ctx.page.getByRole('heading', { name: 'Recent brews' })).toBeVisible();
    },
  },
  brews: {
    prototype: null,
    open: async (ctx) => {
      const recipe = await recipeWithBrew(ctx);
      for (let i = 0; i < 4; i++) {
        await logBrew(ctx, recipe.v1Id, {
          overall: 6 + i * 0.5,
          brewed_at: new Date(Date.now() - (i + 1) * 86_400_000).toISOString(),
        });
      }
      await ctx.page.goto('/brews');
      await waitForApp(ctx.page);
      await expect(ctx.page.getByRole('list', { name: 'Brews' })).toBeVisible();
      await ctx.page
        .locator('label')
        .filter({ has: ctx.page.getByRole('checkbox') })
        .nth(0)
        .click();
      await ctx.page
        .locator('label')
        .filter({ has: ctx.page.getByRole('checkbox') })
        .nth(1)
        .click();
    },
  },
  'brew-compare': {
    prototype: 'src/pages/Compare.tsx',
    open: async (ctx) => {
      const recipe = await recipeWithBrew(ctx);
      const a = await logBrew(ctx, recipe.v1Id);
      const b = await logBrew(ctx, recipe.v1Id, {
        overall: 7,
        sweetness: 6,
        acidity: 7.5,
        body: 6,
        drawdown_s: 190,
        flavours: ['peach', 'cocoa'],
        brewed_at: new Date(Date.now() - 86_400_000).toISOString(),
      });
      await ctx.page.goto(`/brews/compare?ids=${a},${b}`);
      await waitForApp(ctx.page);
      await expect(ctx.page.getByRole('img', { name: /^Taste, compared\./ })).toBeVisible();
    },
  },
  recipes: {
    prototype: 'src/pages/Recipes.tsx',
    open: async (ctx) => {
      await recipeWithBrew(ctx);
      await ctx.page.goto('/recipes');
      await waitForApp(ctx.page);
      await expect(ctx.page.getByRole('list', { name: 'Recipes' })).toBeVisible();
    },
  },
  'brew-picker': {
    prototype: null,
    open: async (ctx) => {
      await recipeWithBrew(ctx);
      await ctx.page.goto('/brew');
      await waitForApp(ctx.page);
      await expect(ctx.page.getByLabel('Search your recipes')).toBeVisible();
    },
  },
  'timer-prep': {
    prototype: 'src/pages/Timer.tsx',
    open: async (ctx) => {
      await stubDevice(ctx.page);
      const recipe = await recipeWithBrew(ctx);
      await ctx.page.goto(`/@${ctx.user.handle}/${recipe.slug}?brew=1`);
      await waitForApp(ctx.page);
      await ctx.page
        .getByRole('dialog', { name: 'Brew this recipe' })
        .getByRole('button', { name: 'Guided timer' })
        .click();
      await ctx.page.waitForURL('**/brew?session=*');
      await expect(ctx.page.getByRole('button', { name: /^Start/ })).toBeVisible();
    },
  },
};
