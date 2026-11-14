import { expect, test, type Locator } from '@playwright/test';
import { openDevPage } from './helpers/dev-page';

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('every field type draws the same shell: border, padding, radius and 44 px height', async ({
      page,
    }) => {
      await openDevPage(page);
      const inputs = page.locator('#inputs');

      // The element that draws the box for each field type.
      const shells: Record<string, Locator> = {
        text: inputs.getByRole('textbox', { name: 'Recipe name' }).first().locator('..'),
        textarea: inputs.getByRole('textbox', { name: 'Notes' }).first().locator('..'),
        select: inputs.getByRole('button', { name: /Method/ }).first(),
        number: inputs
          .getByRole('group')
          .filter({ has: page.getByRole('textbox', { name: 'Bloom' }) })
          .first(),
        time: inputs.getByRole('textbox', { name: 'Total time', exact: true }).locator('..'),
        combobox: inputs
          .getByRole('combobox', { name: 'Grinder', exact: true })
          .first()
          .locator('..'),
      };

      const styles: Record<string, Record<string, string>> = {};
      for (const [name, shell] of Object.entries(shells)) {
        await shell.scrollIntoViewIfNeeded();
        styles[name] = await shell.evaluate((el) => {
          const s = getComputedStyle(el);
          const box = el.getBoundingClientRect();
          return {
            borderWidth: s.borderTopWidth,
            borderStyle: s.borderTopStyle,
            borderColor: s.borderTopColor,
            radius: s.borderTopLeftRadius,
            paddingLeft: s.paddingLeft,
            background: s.backgroundColor,
            height: String(Math.round(box.height)),
          };
        });
      }

      const reference = styles.text!;
      expect(reference.borderStyle).toBe('solid');
      expect(parseFloat(reference.borderWidth!)).toBeGreaterThanOrEqual(1);
      expect(parseFloat(reference.paddingLeft!)).toBeGreaterThanOrEqual(12);
      expect(Number(reference.height)).toBeGreaterThanOrEqual(44);

      for (const [name, s] of Object.entries(styles)) {
        for (const key of ['borderWidth', 'borderStyle', 'borderColor', 'radius', 'background']) {
          expect(s[key], `${name} ${key}`).toBe(reference[key]);
        }
        // Textarea is taller by design; everything else lines up exactly.
        if (name !== 'textarea') {
          expect(s.height, `${name} height`).toBe(reference.height);
          expect(s.paddingLeft, `${name} padding`).toBe(reference.paddingLeft);
        } else {
          expect(Number(s.height)).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });
}

test('an invalid field has a danger border and a focused one an accent border', async ({
  page,
}) => {
  await openDevPage(page);
  const inputs = page.locator('#inputs');
  const border = (el: Locator) => el.evaluate((e) => getComputedStyle(e).borderTopColor);

  const rest = inputs.getByRole('textbox', { name: 'Recipe name' }).first().locator('..');
  const invalid = inputs.getByRole('textbox', { name: 'Handle' }).first().locator('..');
  await invalid.scrollIntoViewIfNeeded();
  const restColor = await border(rest);
  expect(await border(invalid)).not.toBe(restColor);

  await inputs.getByRole('textbox', { name: 'Recipe name' }).first().focus();
  expect(await border(rest)).not.toBe(restColor);
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`focus ring, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('a focused field shows ONE ring on the shell; the inner input has no outline of its own', async ({
      page,
    }) => {
      await openDevPage(page);
      // Every shell on the gallery that contains a text input or textarea.
      const count = await page.locator('#inputs [class*="_control"]:has(input, textarea)').count();
      expect(count).toBeGreaterThan(8);

      const checked: string[] = [];
      for (let i = 0; i < count; i++) {
        const shell = page.locator('#inputs [class*="_control"]:has(input, textarea)').nth(i);
        const inner = shell.locator('input:not([type="hidden"]), textarea').first();
        if (!(await inner.isEnabled()) || !(await inner.isVisible())) continue;
        await inner.focus();
        // Keyboard-style focus so :focus-visible rules apply.
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        const result = await shell.evaluate((el) => {
          const input = el.querySelector('input:not([type="hidden"]), textarea') as HTMLElement;
          const own = getComputedStyle(input);
          const ring = getComputedStyle(el);
          return {
            focused: document.activeElement === input,
            inputOutline: own.outlineStyle,
            inputBorder: own.borderTopWidth,
            shellOutlineStyle: ring.outlineStyle,
            shellOutlineWidth: parseFloat(ring.outlineWidth),
            shellOutlineColor: ring.outlineColor,
            canvas: getComputedStyle(document.body).backgroundColor,
          };
        });
        if (!result.focused) continue; // moved on to a stepper button etc.
        checked.push((await inner.getAttribute('id')) ?? String(i));
        expect(result.inputOutline, `input ${i} own outline`).toBe('none');
        expect(result.inputBorder, `input ${i} own border`).toBe('0px');
        expect(result.shellOutlineStyle, `shell ${i} ring`).toBe('solid');
        expect(result.shellOutlineWidth, `shell ${i} ring width`).toBeGreaterThanOrEqual(2);
      }
      expect(checked.length).toBeGreaterThan(6);
    });

    test('the select trigger has exactly one ring', async ({ page }) => {
      await openDevPage(page);
      const trigger = page
        .locator('#inputs')
        .getByRole('button', { name: /Method/ })
        .first();
      await page.keyboard.press('Tab');
      await trigger.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const ring = await trigger.evaluate((el) => {
        const s = getComputedStyle(el);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
      });
      expect(ring.style).toBe('solid');
      expect(ring.width).toBeGreaterThanOrEqual(2);
    });
  });
}
