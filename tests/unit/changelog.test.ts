import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseChangelog, releaseUrl } from '@/lib/changelog';

const sample = `# Changelog

## [0.3.0](https://github.com/o/r/compare/v0.2.0...v0.3.0) (2026-12-01)


### New features

* **recipes:** add version compare ([#12](https://github.com/o/r/issues/12)) ([abcdef1](https://github.com/o/r/commit/abcdef1234567890))
* plain entry without a scope ([1234567](https://github.com/o/r/commit/1234567890abcdef))


### Fixes

* **timer:** keep the screen awake ([#13](https://github.com/o/r/issues/13)) ([bbbbbbb](https://github.com/o/r/commit/bbbbbbb1234567))


### Performance

* **charts:** load Recharts on demand ([ccccccc](https://github.com/o/r/commit/ccccccc1234567))


### Accessibility

* **ui:** announce the offline banner once ([ddddddd](https://github.com/o/r/commit/ddddddd1234567))


### Tests

* **ui:** hidden section that must not show ([eeeeeee](https://github.com/o/r/commit/eeeeeee1234567))

## [0.2.0](https://github.com/o/r/compare/v0.1.0...v0.2.0) (2026-11-20)

### Chores

* nothing user facing here ([fffffff](https://github.com/o/r/commit/fffffff1234567))

## 0.1.0 (2026-11-13)


### New features

* **infra:** project foundation ([#1](https://github.com/o/r/issues/1)) ([e1ab8c3](https://github.com/o/r/commit/e1ab8c3b3678c3a0c5c051b2dc3a3373f18f0d29))
`;

describe('parseChangelog', () => {
  const releases = parseChangelog(sample);

  it('lists releases newest first, with version and date', () => {
    expect(releases.map((r) => [r.version, r.date])).toEqual([
      ['0.3.0', '2026-12-01'],
      ['0.1.0', '2026-11-13'],
    ]);
  });

  it('reads both heading formats (with and without a compare link)', () => {
    expect(releases.some((r) => r.version === '0.1.0')).toBe(true);
    expect(releases.some((r) => r.version === '0.3.0')).toBe(true);
  });

  it('keeps only New features, Fixes, Performance and Accessibility, in file order', () => {
    expect(releases[0]!.sections.map((s) => s.title)).toEqual([
      'New features',
      'Fixes',
      'Performance',
      'Accessibility',
    ]);
  });

  it('drops releases that have nothing to show', () => {
    expect(releases.find((r) => r.version === '0.2.0')).toBeUndefined();
  });

  it('splits scope, text and commit link, and drops the PR number', () => {
    const [first, second] = releases[0]!.sections[0]!.entries;
    expect(first).toEqual({
      scope: 'recipes',
      text: 'add version compare',
      commitUrl: 'https://github.com/o/r/commit/abcdef1234567890',
    });
    expect(second).toEqual({
      scope: null,
      text: 'plain entry without a scope',
      commitUrl: 'https://github.com/o/r/commit/1234567890abcdef',
    });
  });

  it('turns links and emphasis inside a subject into plain text', () => {
    const [entry] = parseChangelog(
      '## 1.0.0 (2027-01-01)\n\n### Fixes\n\n* **ui:** fix [the thing](https://x.test) and **bold** ([abcdef1](https://github.com/o/r/commit/abcdef1))\n',
    )[0]!.sections[0]!.entries;
    expect(entry!.text).toBe('fix the thing and bold');
  });

  it('copes with Windows line endings', () => {
    expect(parseChangelog(sample.replace(/\n/g, '\r\n'))).toEqual(releases);
  });

  it('returns nothing for empty or unrelated input', () => {
    expect(parseChangelog('')).toEqual([]);
    expect(parseChangelog('# Changelog\n\nNothing yet.\n')).toEqual([]);
  });

  it('reads the real CHANGELOG.md without throwing', () => {
    const real = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'));
    for (const r of real) {
      expect(r.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(r.sections.length).toBeGreaterThan(0);
    }
  });
});

describe('releaseUrl', () => {
  it('points at the vX.Y.Z tag on GitHub', () => {
    expect(releaseUrl('https://github.com/o/r', '0.1.0')).toBe(
      'https://github.com/o/r/releases/tag/v0.1.0',
    );
    expect(releaseUrl('https://github.com/o/r/', '1.2.3')).toBe(
      'https://github.com/o/r/releases/tag/v1.2.3',
    );
  });
});
