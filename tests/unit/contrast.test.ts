import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Checks the colour pairs components actually use, in light and dark, against WCAG 2.2 AA:
 * 4.5:1 for text, 3:1 for the visible edge of a control (borders, focus ring, fills).
 */
const css = readFileSync('src/styles/tokens.css', 'utf8');

function declarations(selectorStart: string): Record<string, string> {
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
  const body = css.slice(open + 1, i - 1).replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

const light = declarations(':root');
const dark = { ...light, ...declarations("[data-theme='dark']") };

function resolve(theme: Record<string, string>, name: string): string {
  let value = theme[name];
  for (let hops = 0; hops < 10 && value; hops++) {
    const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    if (!ref) return value;
    value = theme[ref[1]!];
  }
  throw new Error(`Cannot resolve ${name}`);
}

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1]!.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const surfaces = ['--color-bg-canvas', '--color-bg-surface', '--color-bg-raised'] as const;

/** [foreground, background, minimum ratio, why] */
const pairs: ReadonlyArray<readonly [string, string, number, string]> = [
  // Text
  ...[...surfaces, '--color-bg-field', '--color-bg-inset'].map(
    (bg) => ['--color-text-primary', bg, 4.5, 'body text'] as const,
  ),
  ...[...surfaces, '--color-bg-field'].map(
    (bg) => ['--color-text-secondary', bg, 4.5, 'secondary text'] as const,
  ),
  ['--color-text-muted', '--color-bg-field', 4.5, 'placeholder text'],
  ['--color-text-on-accent', '--color-accent-default', 4.5, 'primary button label'],
  ['--color-accent-default', '--color-bg-canvas', 4.5, 'ghost button and link text'],
  ['--color-accent-default', '--color-bg-surface', 4.5, 'ghost button and link text'],
  ['--color-status-danger', '--color-bg-field', 4.5, 'inline error text'],
  ['--color-status-danger', '--color-bg-surface', 4.5, 'inline error text'],
  ['--color-text-on-accent', '--color-status-danger', 4.5, 'destructive button label'],
  ['--color-changed-fg', '--color-changed-bg', 4.5, 'changed pill'],
  ...(['success', 'warning', 'danger', 'info'] as const).map(
    (s) =>
      [`--color-status-${s}-fg`, `--color-status-${s}-bg`, 4.5, `${s} badge and banner`] as const,
  ),
  // Non-text: the visible edge of controls
  ...[...surfaces, '--color-bg-field'].map(
    (bg) => ['--color-border-field', bg, 3, 'resting field border'] as const,
  ),
  ...surfaces.map((bg) => ['--color-border-strong', bg, 3, 'strong border'] as const),
  ...[...surfaces, '--color-bg-field'].map(
    (bg) => ['--color-focus-ring', bg, 3, 'focus ring'] as const,
  ),
  ['--color-status-danger', '--color-bg-field', 3, 'invalid field border'],
  ['--color-accent-default', '--color-bg-field', 3, 'focused field border'],
  ['--color-accent-default', '--color-bg-canvas', 3, 'filled control edge'],
];

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('contrast in %s theme', (_name, theme) => {
  it.each(pairs)('%s on %s needs %d:1 (%s)', (fg, bg, min) => {
    const ratio = contrast(resolve(theme, fg), resolve(theme, bg));
    expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
  });
});

describe('field shell', () => {
  it('has a distinct resting border, fill and focus colour in both themes', () => {
    for (const theme of [light, dark]) {
      const border = resolve(theme, '--color-border-field');
      expect(border).not.toBe(resolve(theme, '--color-bg-field'));
      expect(border).not.toBe(resolve(theme, '--color-bg-surface'));
    }
  });
});
