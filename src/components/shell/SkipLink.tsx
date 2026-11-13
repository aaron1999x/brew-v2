'use client';

import styles from './SkipLink.module.css';

/** First focusable thing on the page. Moves focus to <main id="main"> (Safari doesn't on its own). */
export function SkipLink() {
  return (
    <a
      href="#main"
      className={styles.skip}
      onClick={(event) => {
        const main = document.getElementById('main');
        if (!main) return;
        event.preventDefault();
        main.focus();
        main.scrollIntoView();
      }}
    >
      Skip to main content
    </a>
  );
}
