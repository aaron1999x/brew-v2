import path from 'node:path';
import { SHOT_SCREENS } from './helpers/ui-shots';
import { expect, signIn, test } from './helpers/test-users';

// Screenshots for the ui-reviewer subagent: only the screens named in UI_SHOTS (comma separated keys
// of SHOT_SCREENS), at 390×844 and 1280×800, light theme, full page, into UI_SHOTS_DIR. Skipped in
// every normal run. Needs the staging secret key like the other specs that make a recipe.
test.use({ serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'light' });

const wanted = (process.env.UI_SHOTS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const dir = process.env.UI_SHOTS_DIR ?? 'test-results/ui-shots';

const SIZES = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

test.describe('ui screenshots', () => {
  test.skip(wanted.length === 0, 'Only runs when UI_SHOTS names the screens to photograph.');

  for (const key of wanted) {
    test(`screenshots of ${key}`, async ({ page, users }) => {
      test.slow();
      const screen = SHOT_SCREENS[key];
      expect(screen, `unknown screen "${key}"; known: ${Object.keys(SHOT_SCREENS).join(', ')}`).toBeTruthy();
      const user = await signIn(page, users, `shot-${key}`.slice(0, 20));
      await page.setViewportSize({ width: SIZES[1].width, height: SIZES[1].height });
      await screen!.open({ page, users, user });
      for (const size of SIZES) {
        await page.setViewportSize(size);
        // Load the page at this size (a chart only measures itself once), then let it settle.
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(dir, `${key}-${size.width}x${size.height}.png`), fullPage: true });
      }
    });
  }
});
