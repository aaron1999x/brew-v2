import { expect, type Page } from '@playwright/test';

/**
 * Finds every grid with two or more columns on the page and reports each field that doesn't fit
 * its column: one that is wider than its cell, runs under its neighbour, or leaves the screen.
 * A field is a grid child; its controls (inputs, buttons) must fit inside it as well.
 */
export async function columnOverflows(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const screenWidth = document.documentElement.clientWidth;
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(el.textContent ?? '').trim().slice(0, 30)}"`;

    for (const grid of document.querySelectorAll<HTMLElement>('main *')) {
      const style = getComputedStyle(grid);
      if (style.display !== 'grid') continue;
      const columns = style.gridTemplateColumns.split(' ').filter(Boolean);
      if (columns.length < 2) continue;
      const gridBox = grid.getBoundingClientRect();
      const cells = Array.from(grid.children).filter(
        (c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().width > 0,
      );

      cells.forEach((cell, i) => {
        const box = cell.getBoundingClientRect();
        const where = `${describe(grid)} > ${describe(cell)}`;
        if (box.right > screenWidth + 0.5) problems.push(`${where}: past the screen edge`);
        if (box.left < -0.5) problems.push(`${where}: past the left edge`);
        if (box.right > gridBox.right + 0.5) problems.push(`${where}: wider than its grid`);
        const next = cells[i + 1];
        if (next && next.getBoundingClientRect().top < box.bottom - 0.5) {
          // On the same row: this cell must end before the next one starts.
          if (box.right > next.getBoundingClientRect().left + 0.5) {
            problems.push(`${where}: runs under ${describe(next)}`);
          }
        }
        // Buttons keep a hidden "Working…" layer under their label, so their scroll width isn't
        // what a person sees; their box is still checked against the grid above.
        const isButton = cell.tagName === 'BUTTON';
        if (!isButton && (cell as HTMLElement).scrollWidth > (cell as HTMLElement).clientWidth + 1) {
          problems.push(`${where}: content wider than the field`);
        }
        for (const inner of cell.querySelectorAll('input, button, [role="group"]')) {
          const innerBox = inner.getBoundingClientRect();
          if (innerBox.width > 0 && innerBox.right > box.right + 0.5) {
            problems.push(`${where}: ${describe(inner)} sticks out of its field`);
          }
        }
      });
    }
    // Whatever the grids missed: anything visible that runs past the right edge of the screen.
    for (const el of document.querySelectorAll<HTMLElement>('main *')) {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (box.width === 0 || style.visibility === 'hidden' || style.position === 'absolute') continue;
      if (el.closest('[aria-hidden="true"], [hidden]')) continue;
      if (box.right > screenWidth + 0.5) {
        problems.push(`${describe(el)} (${el.className}): runs ${Math.round(box.right - screenWidth)} px past the screen`);
      }
    }
    return problems;
  });
}

/** Fails, listing every field that doesn't fit its column at the current viewport width. */
export async function expectColumnsFit(page: Page) {
  expect(await columnOverflows(page)).toEqual([]);
}
