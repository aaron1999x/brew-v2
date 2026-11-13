// Fails if any .css file other than src/styles/tokens.css contains a raw colour or a px font size.
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

function* cssFiles(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* cssFiles(full);
    else if (entry.endsWith('.css')) yield full;
  }
}

export function lintTokens(root = '.') {
  const problems = [];
  for (const file of cssFiles(root)) {
    const rel = relative(root, file).split(sep).join('/');
    if (rel === ALLOWED) continue;
    for (const v of findViolations(readFileSync(file, 'utf8'))) problems.push({ file: rel, ...v });
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
