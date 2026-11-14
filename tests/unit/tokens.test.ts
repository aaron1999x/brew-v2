import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/tokens.css', 'utf8');

/** Custom property names declared in the block that starts with `selector {`. */
function namesIn(selectorStart: string): Set<string> {
  const start = css.indexOf(selectorStart);
  expect(start, selectorStart).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  let depth = 1;
  let i = open + 1;
  while (depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return new Set([...css.slice(open + 1, i - 1).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]!));
}

describe('tokens.css', () => {
  const dark = namesIn("[data-theme='dark']");
  const system = namesIn(":root:not([data-theme='light'])");

  it('declares the same dark names when forced and when following the system', () => {
    expect([...system].sort()).toEqual([...dark].sort());
  });

  it('defines in dark every themed colour/shadow name that light defines', () => {
    const light = [...namesIn(':root')].filter((n) =>
      /^--(color-(bg|text|border|accent|focus|status|changed|selection|chart)|shadow)-/.test(n),
    );
    const missing = light.filter((n) => !dark.has(n));
    expect(missing).toEqual([]);
  });

  it('keeps the PLACEHOLDER header', () => {
    expect(css).toMatch(/^\/\*\r?\n \* PLACEHOLDER/);
  });
});
