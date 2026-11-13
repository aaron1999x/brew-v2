// Fails if any .css file other than src/styles/tokens.css contains a raw colour or a px font size,
// or if a .tsx file sets one in an inline `style` prop.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'docs',
  'coverage',
  'playwright-report',
  'test-results',
]);
const ALLOWED = 'src/styles/tokens.css';

const RULES = [
  { name: 'hex colour', re: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'rgb()/rgba()', re: /\brgba?\(/i },
  { name: 'hsl()/hsla()', re: /\bhsla?\(/i },
  { name: 'px font-size', re: /font-size\s*:[^;}]*\d(?:\.\d+)?px/i },
];

/** Returns [{ line, rule, text }] for one CSS source string. Pure, unit-tested. */
export function findViolations(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const out = [];
  stripped.split('\n').forEach((text, i) => {
    for (const { name, re } of RULES) {
      if (re.test(text)) out.push({ line: i + 1, rule: name, text: text.trim() });
    }
  });
  return out;
}

const INLINE_RULES = [
  { name: 'inline hex colour', re: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'inline rgb()/rgba()', re: /\brgba?\(/i },
  { name: 'inline hsl()/hsla()', re: /\bhsla?\(/i },
  { name: 'inline px font size', re: /font-?size['"]?\s*:\s*(?:['"`][^'"`]*\d(?:\.\d+)?px|\d)/i },
];

/**
 * Returns violations in one .tsx source string. Looks at `style={…}` props only (a brace-balanced
 * scan, so strings elsewhere in the file are never flagged). Pure, unit-tested.
 */
export function findInlineStyleViolations(tsx) {
  const out = [];
  const re = /\bstyle\s*=\s*\{/g;
  let m;
  while ((m = re.exec(tsx))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < tsx.length && depth > 0) {
      if (tsx[i] === '{') depth++;
      else if (tsx[i] === '}') depth--;
      i++;
    }
    const body = tsx.slice(re.lastIndex, i - 1);
    const line = tsx.slice(0, m.index).split('\n').length;
    for (const { name, re: rule } of INLINE_RULES) {
      if (rule.test(body)) out.push({ line, rule: name, text: body.trim().slice(0, 80) });
    }
  }
  return out;
}

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* sourceFiles(full);
    else if (entry.endsWith('.css') || entry.endsWith('.tsx')) yield full;
  }
}

export function lintTokens(root = '.') {
  const problems = [];
  for (const file of sourceFiles(root)) {
    const rel = relative(root, file).split(sep).join('/');
    if (rel === ALLOWED) continue;
    const text = readFileSync(file, 'utf8');
    const found = file.endsWith('.tsx') ? findInlineStyleViolations(text) : findViolations(text);
    for (const v of found) problems.push({ file: rel, ...v });
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = lintTokens();
  if (problems.length) {
    for (const p of problems) console.error(`${p.file}:${p.line}  ${p.rule}: ${p.text}`);
    console.error(
      `\nlint:tokens failed: ${problems.length} raw value(s) outside ${ALLOWED}. Use var(--…) tokens.`,
    );
    process.exit(1);
  }
  console.log('lint:tokens ok');
}
