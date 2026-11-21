'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './timer.module.css';

type Props = Readonly<{
  /** Names the list for assistive technology. */
  label: string;
  children: ReactNode;
}>;

/**
 * A row of chips that share the width equally and, when they don't fit, scroll sideways with
 * snapping. A fade at the edge that has more behind it is the hint that there is more; the row can
 * be scrolled with the keyboard once it overflows (it is focusable only then).
 */
export function ScrollRow({ label, children }: Props) {
  const ref = useRef<HTMLOListElement>(null);
  const [edges, setEdges] = useState({ before: false, after: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const before = el.scrollLeft > 1;
      const after = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((e) => (e.before === before && e.after === after ? e : { before, after }));
    };
    // The observer reports once when it starts, then on every size change.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, []);

  const scrollable = edges.before || edges.after;
  return (
    <ol
      ref={ref}
      className={styles.chipRow}
      aria-label={label}
      tabIndex={scrollable ? 0 : undefined}
      data-before={edges.before}
      data-after={edges.after}
    >
      {children}
    </ol>
  );
}
