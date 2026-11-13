'use client';

import { Coffee, Star, Timer } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/Icon/Icon';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden/VisuallyHidden';
import { ActionsSection } from './ActionsSection';
import { CardsSection } from './CardsSection';
import { FeedbackSection } from './FeedbackSection';
import { InputsSection } from './InputsSection';
import { OverlaysSection } from './OverlaysSection';
import { SelectionSection } from './SelectionSection';
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

const noSubscription = () => () => {};

export function DevComponents() {
  // false while rendering on the server and hydrating, true once React is interactive.
  // Tests wait for it so they never type into a page that isn't listening yet.
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  return (
    <div className={styles.page} data-hydrated={hydrated}>
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
          <p className={styles.note}>Shell layouts:</p>
          <ul className={styles.shellLinks}>
            <li>
              <a href="/home">App shell (tab bar / rail)</a>
            </li>
            <li>
              <a href="/dev/logged-out">Logged-out top bar</a>
            </li>
            <li>
              <a href="/dev/fullscreen">Fullscreen (no navigation)</a>
            </li>
          </ul>
        </section>

        {devSections.slice(1).map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`h-${s.id}`} className={styles.section}>
            <h2 id={`h-${s.id}`} className={styles.sectionTitle}>
              {s.title}
            </h2>
            {s.id === 'actions' ? (
              <ActionsSection />
            ) : s.id === 'inputs' ? (
              <InputsSection />
            ) : s.id === 'selection' ? (
              <SelectionSection />
            ) : s.id === 'cards' ? (
              <CardsSection />
            ) : s.id === 'overlays' ? (
              <OverlaysSection />
            ) : s.id === 'feedback' ? (
              <FeedbackSection />
            ) : (
              <p className={styles.note}>Coming in a later stage.</p>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
