import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden/VisuallyHidden';
import { parseChangelog, releaseUrl, type ChangelogRelease } from '@/lib/changelog';
import { ChangelogSeen } from './ChangelogSeen';
import styles from './changelog.module.css';

export const metadata: Metadata = {
  title: "What's new",
  description: `Release notes for ${siteConfig.name}.`,
};

/** Read once, at build time: the page is static and CHANGELOG.md is written by release-please. */
function loadReleases(): ChangelogRelease[] {
  try {
    return parseChangelog(readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf8'));
  } catch {
    return [];
  }
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export default function ChangelogPage() {
  const releases = loadReleases();

  return (
    <>
      <ChangelogSeen />
      <h1 className={styles.title}>What&apos;s new</h1>
      {releases.length === 0 ? (
        <EmptyState
          title="No release notes yet."
          text="New features and fixes will be listed here after each release."
          headingLevel={2}
        />
      ) : (
        <div className={styles.releases}>
          {releases.map((release) => (
            <section
              key={release.version}
              aria-labelledby={`release-${release.version}`}
              className={styles.release}
            >
              <header className={styles.releaseHeader}>
                <h2 id={`release-${release.version}`} className={styles.version}>
                  <a
                    href={releaseUrl(siteConfig.repoUrl, release.version)}
                    className={styles.versionLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    v{release.version}
                    <VisuallyHidden> (GitHub release, opens in a new tab)</VisuallyHidden>
                  </a>
                </h2>
                <time dateTime={release.date} className={styles.date}>
                  {dateFormat.format(new Date(`${release.date}T00:00:00Z`))}
                </time>
              </header>
              {release.sections.map((section) => (
                <div key={section.title} className={styles.section}>
                  <h3 className={styles.sectionTitle}>{section.title}</h3>
                  <ul className={styles.entries}>
                    {section.entries.map((entry, i) => (
                      <li key={`${entry.text}-${i}`} className={styles.entry}>
                        {entry.scope ? <span className={styles.scope}>{entry.scope}</span> : null}
                        <span>{entry.text}</span>
                        {entry.commitUrl ? (
                          <a
                            href={entry.commitUrl}
                            className={styles.viewChange}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            view change
                            <VisuallyHidden>{`: ${entry.text} (opens in a new tab)`}</VisuallyHidden>
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
