import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/dev/components');
  // Interacting before React has hydrated does nothing, so wait for the page to say it's ready.
  await page.locator('[data-hydrated="true"]').waitFor();
});

test('a pending button keeps its width and ignores presses', async ({ page }) => {
  const button = page.locator('button', { hasText: 'Save recipe' });
  const before = (await button.boundingBox())!.width;
  await button.click();
  const pending = page.locator('button[data-pending]', { hasText: 'Save recipe' });
  await expect(pending).toBeVisible();
  const during = (await pending.boundingBox())!.width;
  expect(Math.abs(during - before)).toBeLessThan(1);
  await expect(pending.getByRole('progressbar', { name: 'Saving…' })).toBeAttached();
  await expect(button).toBeVisible({ timeout: 5000 });
});

test('the time input understands what was typed and normalises on blur', async ({ page }) => {
  const input = page.getByLabel('Total time', { exact: true });
  await input.scrollIntoViewIfNeeded();
  await input.clear();
  await input.pressSequentially('150');
  await expect(page.getByText('Understood as 1:50')).toBeVisible();
  await input.blur();
  await expect(input).toHaveValue('1:50');
  await input.clear();
  await input.pressSequentially('2:75');
  await input.blur();
  await expect(page.getByText('Enter a time like 2:30, 230 or 150s').first()).toBeVisible();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
});

test('the slider reads "7.5 out of 10" and moves in half steps with the arrow keys', async ({
  page,
}) => {
  const slider = page.getByRole('slider', { name: 'Sweetness' });
  await expect(slider).toHaveAttribute('aria-valuetext', '7.5 out of 10');
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', '8 out of 10');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuetext', '7 out of 10');
});

test('the number field puts its unit in the accessible description', async ({ page }) => {
  const field = page.getByRole('textbox', { name: 'Water temperature' }).first();
  await expect(field).toHaveAccessibleDescription(/degrees Celsius/);
});

test('the combobox offers "Use what I typed" and reports free text', async ({ page }) => {
  const box = page.getByRole('combobox', { name: 'Grinder (free text allowed)' });
  // Scroll first: a scroll while the list is open would close it (as it should).
  await box.scrollIntoViewIfNeeded();
  await box.pressSequentially('Home-made grinder');
  const option = page.getByRole('option', { name: /Use what I typed/ });
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.getByText('Using free text “Home-made grinder”.')).toBeVisible();
});

test('the combobox filters by every word and shows an empty state', async ({ page }) => {
  const box = page.getByRole('combobox', { name: 'Grinder', exact: true }).first();
  await box.scrollIntoViewIfNeeded();
  await box.pressSequentially('c40 coman');
  await expect(page.getByRole('option')).toHaveCount(1);
  await box.clear();
  await box.pressSequentially('zzzz');
  await expect(page.getByText('No matches. Keep typing or try another word.')).toBeVisible();
});

test('the segmented control moves with the arrow keys', async ({ page }) => {
  const roast = page.getByRole('radiogroup', { name: 'Roast' });
  await roast.getByRole('radio', { name: 'Medium' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(roast.getByRole('radio', { name: 'Dark' })).toBeChecked();
  await expect(page.getByText('Roast: dark')).toBeVisible();
});

test('flavour tags can be added, selected and removed', async ({ page }) => {
  const add = page.getByRole('textbox', { name: 'Add your own' });
  await add.scrollIntoViewIfNeeded();
  await add.pressSequentially('toasted almond');
  await add.press('Enter');
  const tag = page.getByRole('row', { name: /toasted almond/i });
  await expect(tag).toBeVisible();
  await expect(tag).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Remove toasted almond' }).click();
  await expect(page.getByRole('row', { name: /toasted almond/i })).toHaveCount(0);
});

test('a recipe card is a single link that covers the card', async ({ page }) => {
  const link = page.getByRole('link', { name: 'Washed Ethiopia, 1:16 V60' }).first();
  const card = page.locator('article', { has: link }).first();
  const cardBox = (await card.boundingBox())!;
  const linkBox = (await link.evaluate((el) => {
    const r = getComputedStyle(el, '::after');
    return { position: r.position };
  })) as { position: string };
  expect(linkBox.position).toBe('absolute');
  expect(cardBox.height).toBeGreaterThan(44);
});
