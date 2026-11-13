'use client';

import { Coffee, Star, Timer } from 'lucide-react';
import { Icon } from '@/components/ui/Icon/Icon';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden/VisuallyHidden';
import { devSections } from './sections';
import { ThemeSwitch } from './ThemeSwitch';
import styles from './dev.module.css';

const swatches = [
  ['bg-canvas', '--color-bg-canvas'],
  ['bg-surface', '--color-bg-surface'],
  ['bg-raised', '--color-bg-raised'],
  ['bg-inset', '--color-bg-inset'],
  ['accent', '--color-accent-default'],
  ['status-success-bg', '--color-status-success-bg'],
  ['status-warning-bg', '--color-status-warning-bg'],
  ['status-danger-bg', '--color-status-danger-bg'],
  ['status-info-bg', '--color-status-info-bg'],
  ['changed-bg', '--color-changed-bg'],
] as const;

export function DevComponents() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Components</h1>
        <ThemeSwitch />
        <nav aria-label="Sections" className={styles.sectionNav}>
          <ul>
            {devSections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main">
        <section id="foundations" aria-labelledby="h-foundations" className={styles.section}>
          <h2 id="h-foundations" className={styles.sectionTitle}>
            Foundations
          </h2>
          <p className={styles.note}>
            Placeholder tokens. Switch the theme above; every section below follows it.
          </p>
          <ul className={styles.swatches}>
            {swatches.map(([name, token]) => (
              <li key={name} className={styles.swatch}>
                <span className={styles.chip} style={{ background: `var(${token})` }} />
                <span>{name}</span>
              </li>
            ))}
          </ul>
          <div className={styles.typeSamples}>
            <p>Body text in Inter, 16 px: the quick brown fox.</p>
            <p className="num">Tabular numerals: 0123456789 · 1:30 · 18.5 g · 93 °C</p>
          </div>
          <div className={styles.iconRow}>
            <Icon icon={Coffee} size="sm" />
            <Icon icon={Timer} size="md" />
            <Icon icon={Star} size="lg" label="Favourite" />
            <VisuallyHidden>Icon sizes: small, medium, large</VisuallyHidden>
          </div>
        </section>

        {devSections.slice(1).map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`h-${s.id}`} className={styles.section}>
            <h2 id={`h-${s.id}`} className={styles.sectionTitle}>
              {s.title}
            </h2>
            <p className={styles.note}>Coming in a later stage.</p>
          </section>
        ))}
      </main>
    </div>
  );
}
