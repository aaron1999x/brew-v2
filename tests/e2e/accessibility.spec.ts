import { openDevPage } from './helpers/dev-page';
import { expect, signIn, test } from './helpers/test-users';

test.describe('target size', () => {
  test('primary controls are at least 44×44 and nothing interactive is below 24×24', async ({
    page,
  }) => {
    await openDevPage(page);
    // Open the charts' data tables too, so their summaries and tables are in the measurement.
    const result = await page.evaluate(() => {
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        // Skip hidden inputs (React Aria's visually-hidden radios, checkboxes and sliders),
        // anything not rendered, and the skip link parked off screen.
        if (!(r.width > 2 && r.height > 2) || s.visibility === 'hidden' || s.display === 'none') {
          return false;
        }
        // React Aria draws radios, checkboxes, switches and selects with a visually hidden native
        // input; the visible label or track is the real target and is measured on its own.
        for (
          let node: Element | null = el;
          node && node !== document.body;
          node = node.parentElement
        ) {
          const ns = getComputedStyle(node);
          if (node.getAttribute('aria-hidden') === 'true' || ns.opacity === '0') return false;
          if (ns.clipPath !== 'none' || (ns.clip !== 'auto' && ns.position === 'absolute'))
            return false;
        }
        // A card title link whose ::after stretches over the whole card: the card is the target.
        const after = getComputedStyle(el, '::after');
        if (el.tagName === 'A' && after.position === 'absolute' && after.content !== 'none')
          return false;
        return true;
      };
      const describe = (el: Element) => {
        const r = el.getBoundingClientRect();
        const label =
          el.getAttribute('aria-label') || (el.textContent ?? '').trim().slice(0, 30) || el.tagName;
        return `${el.tagName.toLowerCase()} "${label}" ${Math.round(r.width)}×${Math.round(r.height)}`;
      };

      const primary = [...document.querySelectorAll('[data-primary-control]')].filter(visible);
      const smallPrimary = primary
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width < 43.5 || r.height < 43.5;
        })
        .map(describe);

      const interactive = [
        ...document.querySelectorAll(
          'a[href], button, summary, [role="slider"], [role="switch"], [role="radio"], [role="checkbox"], input:not([type="hidden"]), textarea, select',
        ),
      ].filter(visible);
      const tiny = interactive
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width < 23.5 || r.height < 23.5;
        })
        .map(describe);

      return {
        primaryCount: primary.length,
        smallPrimary,
        interactiveCount: interactive.length,
        tiny,
      };
    });

    expect(result.primaryCount).toBeGreaterThan(40);
    expect(result.interactiveCount).toBeGreaterThan(80);
    expect(result.smallPrimary, 'primary controls under 44×44').toEqual([]);
    expect(result.tiny, 'interactive elements under 24×24').toEqual([]);
  });

  test('the shell navigation targets are at least 44×44', async ({ page, users }) => {
    await signIn(page, users);
    await page.goto('/home');
    const nav = page.getByRole('navigation', { name: 'Main' });
    const links = nav.getByRole('link');
    const count = await links.count();
    expect(count).toBe(5);
    for (let i = 0; i < count; i++) {
      const box = (await links.nth(i).boundingBox())!;
      expect(box.width, `link ${i} width`).toBeGreaterThanOrEqual(43.5);
      expect(box.height, `link ${i} height`).toBeGreaterThanOrEqual(43.5);
    }
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  /** "0.001ms" computes to "1e-06s"; lists are comma separated. */
  const seconds = (value: string) => value.split(',').map((v) => parseFloat(v));

  test('overlays, toasts and the spinner have effectively no animation', async ({ page }) => {
    await openDevPage(page);

    await page.getByRole('button', { name: 'Open sheet' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this recipe' });
    await expect(dialog).toBeVisible();
    const sheet = await page.evaluate(() => {
      const out: Record<string, { animation: string; transition: string }> = {};
      const modal = document.querySelector('[role="dialog"]')!.closest('[class*="modal"]')!;
      const overlay = modal.parentElement!;
      for (const [name, el] of [
        ['overlay', overlay],
        ['modal', modal],
      ] as const) {
        const s = getComputedStyle(el);
        out[name] = { animation: s.animationDuration, transition: s.transitionDuration };
      }
      return out;
    });
    for (const [name, d] of Object.entries(sheet)) {
      for (const v of [...seconds(d.animation), ...seconds(d.transition)]) {
        expect(v, `${name} duration`).toBeLessThanOrEqual(0.01);
      }
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: 'Success', exact: true }).click();
    const toast = page.getByRole('status').filter({ hasText: 'Saved as v4.' });
    await expect(toast).toBeVisible();
    const toastDurations = await toast.evaluate((el) => {
      const chain: string[] = [];
      for (
        let node: Element | null = el;
        node && node !== document.body;
        node = node.parentElement
      ) {
        const s = getComputedStyle(node);
        chain.push(s.animationDuration, s.transitionDuration);
      }
      return chain;
    });
    for (const d of toastDurations) {
      for (const v of seconds(d)) expect(v).toBeLessThanOrEqual(0.01);
    }

    const spinner = await page
      .locator('button[data-pending] [role="progressbar"]')
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { duration: s.animationDuration, count: s.animationIterationCount };
      })
      .catch(() => null);
    if (spinner) {
      for (const v of seconds(spinner.duration)) expect(v).toBeLessThanOrEqual(0.01);
    }
  });

  test('charts do not animate', async ({ page }) => {
    await openDevPage(page);
    const animated = await page.evaluate(
      () =>
        [...document.querySelectorAll('#charts [class*="recharts"]')].filter((el) => {
          const s = getComputedStyle(el);
          return s.animationName !== 'none' && parseFloat(s.animationDuration) > 0.01;
        }).length,
    );
    expect(animated).toBe(0);
  });
});

test.describe('keyboard', () => {
  test.beforeEach(({}, testInfo) => {
    // Touch devices have no Tab key.
    test.skip(testInfo.project.name.startsWith('iphone'), 'keyboard only');
  });

  test('tab order starts with the theme control and the section links, and every stop is visible', async ({
    page,
  }) => {
    await openDevPage(page);
    // Start where a keyboard user starts: the top of the page.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('heading', { level: 1, name: 'Components' }).click();
    const stops: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return { name: 'BODY', visible: false };
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        // React Aria's hidden radio inputs are focused but drawn by a sibling or parent.
        const host = el.closest('label, [role="radio"], [role="slider"], [data-rac]') ?? el;
        const hr = host.getBoundingClientRect();
        return {
          name:
            el.getAttribute('aria-label') ||
            (el.textContent ?? '').trim().slice(0, 24) ||
            (el as HTMLInputElement).value ||
            el.tagName,
          visible: (r.width > 0 || hr.width > 0) && s.visibility !== 'hidden',
        };
      });
      expect(stop.visible, `stop ${i + 1}: ${stop.name}`).toBe(true);
      stops.push(stop.name);
    }
    // After the theme group (one tab stop), the section links follow in document order.
    const links = ['Foundations', 'Actions', 'Inputs', 'Chips and badges', 'Cards and lists'];
    const first = stops.findIndex((s) => s === links[0]);
    expect(first).toBeGreaterThan(0);
    expect(stops.slice(first, first + links.length)).toEqual(links);
    // The theme control comes first: arrow keys, not Tab, move between its three options.
    expect(first).toBeLessThanOrEqual(2);
  });

  test('combobox: type, arrow down, Enter chooses; Escape closes', async ({ page }) => {
    await openDevPage(page);
    const box = page.getByRole('combobox', { name: 'Grinder', exact: true }).first();
    await box.scrollIntoViewIfNeeded();
    await box.focus();
    await page.keyboard.type('fel');
    await expect(page.getByRole('option')).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(box).toHaveValue('Fellow Ode Gen 2');
    await expect(page.getByText('Chose “Fellow Ode Gen 2”.')).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(0);

    await box.press('ControlOrMeta+a');
    await page.keyboard.type('c');
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('option')).toHaveCount(0);
  });

  test('select: Enter opens, arrows move, Enter chooses, focus returns to the trigger', async ({
    page,
  }) => {
    await openDevPage(page);
    const trigger = page
      .locator('#inputs')
      .getByRole('button', { name: /Method/ })
      .first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
