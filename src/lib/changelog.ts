/** What a release-please CHANGELOG.md says, reduced to what the /changelog page shows. */

export type ChangelogEntry = {
  /** Plain text of the change, without scope, PR number or commit link. */
  text: string;
  /** The conventional-commit scope, e.g. "infra". */
  scope: string | null;
  /** Link to the commit on GitHub, when the line has one. */
  commitUrl: string | null;
};

export type ChangelogSection = { title: string; entries: ChangelogEntry[] };

export type ChangelogRelease = {
  version: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  sections: ChangelogSection[];
};

/** The only sections users see (the rest are hidden in release-please-config.json anyway). */
export const VISIBLE_SECTIONS = ['New features', 'Fixes', 'Performance', 'Accessibility'] as const;

// "## 0.1.0 (2026-11-13)" or "## [0.2.0](https://…/compare/v0.1.0...v0.2.0) (2026-11-20)"
const RELEASE_HEADING =
  /^##\s+\[?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]?(?:\([^)]*\))?\s*\((\d{4}-\d{2}-\d{2})\)\s*$/;
const SECTION_HEADING = /^###\s+(.+?)\s*$/;
const COMMIT_LINK = /\(\[[0-9a-f]{7,40}\]\((https?:\/\/[^)\s]+\/commit\/[^)\s]+)\)\)\s*$/i;
const PR_LINK = /\(\[#\d+\]\([^)]*\)\)/g;

function parseEntry(line: string): ChangelogEntry | null {
  if (!/^[*-]\s+/.test(line)) return null;
  let rest = line.replace(/^[*-]\s+/, '').trim();

  const commit = COMMIT_LINK.exec(rest);
  const commitUrl = commit ? commit[1]! : null;
  if (commit) rest = rest.slice(0, commit.index).trim();

  rest = rest.replace(PR_LINK, '').trim();

  const scopeMatch = /^\*\*([^*]+):\*\*\s*/.exec(rest);
  const scope = scopeMatch ? scopeMatch[1]!.trim() : null;
  if (scopeMatch) rest = rest.slice(scopeMatch[0].length);

  // Links and emphasis in a commit subject become plain text.
  const text = rest
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return text ? { text, scope, commitUrl } : null;
}

/**
 * Parses CHANGELOG.md text. Newest release first (file order is kept, release-please writes newest
 * first). Releases and sections with nothing to show are dropped.
 */
export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let release: ChangelogRelease | null = null;
  let section: ChangelogSection | null = null;

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();

    const heading = RELEASE_HEADING.exec(line);
    if (heading) {
      release = { version: heading[1]!, date: heading[2]!, sections: [] };
      releases.push(release);
      section = null;
      continue;
    }
    if (/^##\s/.test(line)) {
      // Some other level-2 heading: not a release we can read.
      release = null;
      section = null;
      continue;
    }

    const sectionHeading = SECTION_HEADING.exec(line);
    if (sectionHeading && release) {
      const title = sectionHeading[1]!;
      section = (VISIBLE_SECTIONS as readonly string[]).includes(title)
        ? { title, entries: [] }
        : null;
      if (section) release.sections.push(section);
      continue;
    }

    if (section) {
      const entry = parseEntry(line);
      if (entry) section.entries.push(entry);
    }
  }

  return releases
    .map((r) => ({ ...r, sections: r.sections.filter((s) => s.entries.length > 0) }))
    .filter((r) => r.sections.length > 0);
}

/** The GitHub Release page for a version; tags are "vX.Y.Z" (release-please-config.json). */
export function releaseUrl(repoUrl: string, version: string): string {
  return `${repoUrl.replace(/\/$/, '')}/releases/tag/v${version}`;
}
