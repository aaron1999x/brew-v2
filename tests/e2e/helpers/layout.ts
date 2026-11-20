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
      // Cells in the flow only: a visually hidden helper (absolute) takes no grid cell.
      const cells = Array.from(grid.children).filter((c) => {
        const cs = getComputedStyle(c);
        return (
          cs.display !== 'none' &&
          cs.position !== 'absolute' &&
          cs.position !== 'fixed' &&
          c.getBoundingClientRect().width > 0
        );
      });

      cells.forEach((cell, i) => {
        const box = cell.getBoundingClientRect();
        const where = `${describe(grid)} > ${describe(cell)}`;
        if (box.right > screenWidth + 0.5) problems.push(`${where}: past the screen edge`);
        if (box.left < -0.5) problems.push(`${where}: past the left edge`);
        if (box.right > gridBox.right + 0.5) problems.push(`${where}: wider than its grid`);
        // Cells that share a row must not overlap sideways, whatever their order in the DOM.
        for (const other of cells.slice(i + 1)) {
          const o = other.getBoundingClientRect();
          const sharesRow = o.top < box.bottom - 0.5 && box.top < o.bottom - 0.5;
          const overlapsSideways = box.left < o.right - 0.5 && o.left < box.right - 0.5;
          if (sharesRow && overlapsSideways) problems.push(`${where}: runs under ${describe(other)}`);
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
    // Text kept for screen readers only is clipped to nothing; it takes no room on screen.
    const insideVisuallyHidden = (el: Element) => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        const s = getComputedStyle(node);
        if (s.position === 'absolute' && (s.clip !== 'auto' || s.clipPath !== 'none')) return true;
      }
      return false;
    };

    // Whatever the grids missed: anything visible that runs past the right edge of the screen.
    for (const el of document.querySelectorAll<HTMLElement>('main *')) {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (box.width === 0 || style.visibility === 'hidden' || style.position === 'absolute') continue;
      if (el.closest('[aria-hidden="true"], [hidden]') || insideVisuallyHidden(el)) continue;
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
