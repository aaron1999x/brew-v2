import type { Page } from '@playwright/test';
import {
  dismissMissed,
  openPrep,
  pauseClockSoon,
  stubDevice,
  VARIED,
} from './helpers/brew-device';
import { createRecipe } from './helpers/recipes';
import { expect, signIn, test } from './helpers/test-users';

// Every timer screen must fit the visible screen with no scrolling and nothing clipped, on an
// iPhone SE (375 × 548) and an iPhone 14 (390 × 664) with Safari's toolbars showing. The check fails
// if the page scrolls, if the focus card, the clock or any control is outside the screen, if the
// card's content spills out of it, or if the card runs into the controls below it.
test.use({ serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London' });

const SIZES = [
  { name: 'iPhone SE (375 × 548)', width: 375, height: 548 },
  { name: 'iPhone 14 (390 × 664)', width: 390, height: 664 },
] as const;

type Scope = 'running' | 'prep';

/** Collects every way the screen doesn't fit; the test fails with the list. */
async function expectFitsScreen(page: Page, scope: Scope) {
  const problems = await page.evaluate((scope) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollHeight > vh + 1) out.push(`the page scrolls: ${doc.scrollHeight} px of content in ${vh} px`);
    if (doc.scrollWidth > vw + 1) out.push(`the page is wider than the screen: ${doc.scrollWidth} > ${vw}`);

    const describe = (el: Element) =>
      (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
    const rect = (el: Element) => el.getBoundingClientRect();
    const shown = (el: Element) => {
      const r = rect(el);
      return r.width > 0 && r.height > 0;
    };
    const onScreen = (el: Element, what: string) => {
      const r = rect(el);
      if (r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5) {
        out.push(
          `${what} "${describe(el)}" is off screen: top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)}, left ${Math.round(r.left)}, right ${Math.round(r.right)} (screen ${vw} × ${vh})`,
        );
      }
    };

    const controls = [...document.querySelectorAll('main button')].filter(shown);
    if (scope === 'prep') {
      const start = controls.find((b) => /^Start/.test(b.textContent ?? ''));
      if (!start) out.push('no Start button');
      else onScreen(start, 'button');
      const h1 = document.querySelector('main h1');
      if (h1) onScreen(h1, 'title');
      // The content scrolls inside its own area and ends above the Start button.
      const scroller = document.querySelector<HTMLElement>('[class*="prepScroll"]');
      if (!scroller) out.push('no scrolling content area');
      else if (start) {
        onScreen(scroller, 'content area');
        const last = scroller.lastElementChild;
        // Enough room: the sections are spread out, so there is no big empty gap above Start.
        if (last && scroller.scrollHeight <= scroller.clientHeight + 1) {
          const gap = rect(scroller).bottom - rect(last).bottom;
          if (gap > 72) out.push(`there is a ${Math.round(gap)} px empty gap above Start`);
        }
        scroller.scrollTop = scroller.scrollHeight;
        if (last && rect(last).bottom > rect(start).top + 1) {
          out.push(`the last line "${describe(last)}" ends under the Start button`);
        }
      }
      return out;
    }

    for (const button of controls) {
      onScreen(button, 'button');
      const r = rect(button);
      if (r.height < 43.5) out.push(`button "${describe(button)}" is only ${Math.round(r.height)} px tall`);
      // The label sits inside its button, in the middle (End brew used to hug the right edge).
      const label = button.firstElementChild;
      if (label) {
        const l = rect(label);
        if (l.left < r.left - 0.5 || l.right > r.right + 0.5) {
          out.push(`the label of "${describe(button)}" sticks out of its button`);
        }
        const off = Math.abs((l.left + l.right) / 2 - (r.left + r.right) / 2);
        if (off > 3) out.push(`the label of "${describe(button)}" is ${Math.round(off)} px off centre`);
      }
    }
    for (const el of document.querySelectorAll('main [role="timer"], main h1')) {
      if (shown(el)) onScreen(el, el.tagName === 'H1' ? 'title' : 'clock');
    }
    const cards = [...document.querySelectorAll('main section[aria-label]')].filter(shown);
    for (const card of cards) {
      onScreen(card, 'card');
      if (card.scrollHeight > card.clientHeight + 1 || card.scrollWidth > card.clientWidth + 1) {
        out.push(`card "${describe(card)}" is clipped: content ${card.scrollHeight} × ${card.scrollWidth}, box ${card.clientHeight} × ${card.clientWidth}`);
      }
      const c = rect(card);
      for (const child of card.querySelectorAll('*')) {
        if (!shown(child)) continue;
        const r = rect(child);
        if (r.top < c.top - 1 || r.bottom > c.bottom + 1 || r.left < c.left - 1 || r.right > c.right + 1) {
          out.push(`"${describe(child)}" spills out of card "${describe(card)}"`);
        }
      }
      // The controls under the card (not the Sound button in the bar above it).
      const below = controls.filter((b) => rect(b).top >= c.top);
      const firstControlTop = Math.min(...below.map((b) => rect(b).top));
      if (below.length > 0 && c.bottom > firstControlTop + 1) {
        out.push(`card "${describe(card)}" runs into the controls`);
      }
      if (below.length > 0 && firstControlTop - c.bottom > 24 && card.getAttribute('aria-label') !== 'Get ready' && !document.querySelector('[class*="steepList"]')) {
        out.push(`card "${describe(card)}" floats ${Math.round(firstControlTop - c.bottom)} px above the controls`);
      }
      const timer = document.querySelector('main [role="timer"]');
      if (timer && shown(timer) && rect(timer).bottom > c.top + 1) {
        out.push(`the clock runs into card "${describe(card)}"`);
      }
    }
    return out;
  }, scope);
  expect(problems, problems.join('\n')).toEqual([]);
}

for (const size of SIZES) {
  test.describe(`timer screens fit ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test.beforeEach(async ({ page }) => {
      await stubDevice(page);
    });

    test('prep: the Start button is on screen and the content scrolls above it', async ({ page, users }) => {
      const user = await signIn(page, users, 'fit-prep');
      const recipe = await createRecipe(users, user, 'Varied', {
        version: { ...VARIED, gear: { brewer: { name: 'Hario V60 02' }, grinder: { name: 'Comandante C40' } } },
      });
      await openPrep(page, user, recipe.slug);
      await expectFitsScreen(page, 'prep');
      // With "Change for this brew" open (the tallest the prep screen gets).
      await page.getByRole('button', { name: /Change for this brew/ }).click();
      await expectFitsScreen(page, 'prep');
    });

    test('count-in: the number card, the first step and the buttons', async ({ page, users }) => {
      const user = await signIn(page, users, 'fit-countin');
      const recipe = await createRecipe(users, user, 'Varied', { version: VARIED });
      await page.clock.install();
      await openPrep(page, user, recipe.slug);
      await pauseClockSoon(page);
      await page.getByRole('button', { name: 'Start', exact: true }).click();
      await expect(page.getByLabel('Get ready')).toBeVisible();
      await expect(page.getByText('Bloom → 40 g · 65 °C')).toBeVisible();
      await expectFitsScreen(page, 'running');
    });

    test('running: the fullest card (status, next pour, weight, amount, kettle chip, countdown), also paused', async ({
      page,
      users,
    }) => {
      const user = await signIn(page, users, 'fit-running');
      const recipe = await createRecipe(users, user, 'Varied', { version: VARIED });
      await page.clock.install();
      await openPrep(page, user, recipe.slug);
      await pauseClockSoon(page);
      await page.getByRole('button', { name: 'Start', exact: true }).click();
      await page.clock.runFor(5200);
      await expectFitsScreen(page, 'running'); // straight after the bloom pour starts

      await page.clock.fastForward(20_000);
      await page.clock.runFor(150);
      await dismissMissed(page);
      const card = page.getByLabel('Current step');
      await expect(card).toContainText('Switch kettle → 92 °C');
      await expect(card).toContainText('+60 g this pour');
      await expectFitsScreen(page, 'running');

      // Paused adds a "Paused" tag under the clock.
      await page.getByRole('button', { name: 'Pause' }).click();
      await expect(page.getByText('Paused', { exact: true })).toBeVisible();
      await expectFitsScreen(page, 'running');
    });

    test('running: a swirl as the next step, and after the last pour', async ({ page, users }) => {
      const user = await signIn(page, users, 'fit-last');
      const recipe = await createRecipe(users, user, 'Varied', { version: VARIED });
      await page.clock.install();
      await openPrep(page, user, recipe.slug);
      await pauseClockSoon(page);
      await page.getByRole('button', { name: 'Start', exact: true }).click();
      await page.clock.runFor(5200);

      await page.clock.fastForward(45_000);
      await page.clock.runFor(150);
      await dismissMissed(page);
      await expect(page.getByLabel('Current step')).toContainText('Next: Swirl at 1:00');
      await expectFitsScreen(page, 'running');

      await page.clock.fastForward(40_000);
      await page.clock.runFor(150);
      await dismissMissed(page);
      await expect(page.getByLabel('Current step')).toContainText('Last pour done');
      await expect(page.getByRole('button', { name: 'Drawdown done' })).toBeVisible();
      await expectFitsScreen(page, 'running');
    });

    test('stopwatch', async ({ page, users }) => {
      const user = await signIn(page, users, 'fit-stopwatch');
      const recipe = await createRecipe(users, user, 'Open brew', { version: { steps: [] } });
      await page.clock.install();
      await openPrep(page, user, recipe.slug);
      await pauseClockSoon(page);
      await page.getByRole('button', { name: 'Start', exact: true }).click();
      await page.clock.runFor(5200 + 2000);
      await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
      await expectFitsScreen(page, 'running');
    });

    test('long steep with a list of steps', async ({ page, users }) => {
      const user = await signIn(page, users, 'fit-steep');
      const recipe = await createRecipe(users, user, 'Cold brew', {
        method: 'cold_brew',
        version: {
          dose_g: 60,
          brew_water_g: 600,
          steps: [
            { id: 'a', kind: 'pour', at_s: 0, target_g: 200 },
            { id: 'b', kind: 'stir', at_s: 30, duration_s: 10 },
            { id: 'c', kind: 'pour', at_s: 60, target_g: 400 },
            { id: 'd', kind: 'stir', at_s: 120, duration_s: 10 },
            { id: 'e', kind: 'pour', at_s: 180, target_g: 600 },
            { id: 'f', kind: 'wait', at_s: 240, duration_s: 43_200 },
            { id: 'g', kind: 'other', at_s: 43_440, label: 'Open valve' },
            { id: 'h', kind: 'other', at_s: 43_500, label: 'Bottle it' },
          ],
        },
      });
      await openPrep(page, user, recipe.slug);
      await expectFitsScreen(page, 'prep');
      await page.getByRole('button', { name: 'Start steep' }).click();
      await expect(page.getByText('Steeping for', { exact: true })).toBeVisible();
      await expectFitsScreen(page, 'running');
    });
  });
}
