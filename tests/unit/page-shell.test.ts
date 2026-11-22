import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Every page sets its width through PageShell, so a new page can't fall back to some other
// container. A page that only calls notFound() or redirect() renders nothing and is exempt.
const APP = path.join(process.cwd(), 'src', 'app');

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return pages(p);
    return e.name === 'page.tsx' ? [p] : [];
  });
}

/** The JSX a page returns: every `return <X …` or `return ( <X …`, as the name of the first element. */
function returnedRoots(source: string): string[] {
  return [...source.matchAll(/\breturn\s*\(?\s*<\s*([A-Za-z]*)/g)].map((m) => m[1] || '(fragment)');
}

describe('PageShell', () => {
  const files = pages(APP);

  it('finds the pages', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it.each(files.map((f) => [path.relative(process.cwd(), f).replaceAll('\\', '/'), f] as const))(
    '%s renders inside PageShell',
    (_name, file) => {
      const source = readFileSync(file, 'utf8');
      const roots = returnedRoots(source);
      if (roots.length === 0) return; // notFound() or redirect() only
      expect(roots.filter((r) => r !== 'PageShell')).toEqual([]);
      expect(source).toContain("from '@/components/shell/PageShell'");
    },
  );

  it('no stylesheet outside PageShell sets a page-level width', () => {
    // Component widths (a 28rem auth card, a 36rem empty state) are content, not page widths; the
    // page-level tokens are only used by the shell.
    const uses = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return uses(p);
        if (!e.name.endsWith('.css') || e.name === 'tokens.css') return [];
        return /max-width:\s*var\(--layout-(wide|form|reading)\)/.test(readFileSync(p, 'utf8')) ? [p] : [];
      });
    const found = uses(path.join(process.cwd(), 'src')).map((p) =>
      path.relative(process.cwd(), p).replaceAll('\\', '/'),
    );
    // The signed-in shell's box (it holds the top bar, so it matches the wide page width).
    expect(found.sort()).toEqual(['src/app/(app)/shell.module.css', 'src/components/shell/PageShell.module.css']);
  });
});
