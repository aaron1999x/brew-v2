import type { LucideIcon } from 'lucide-react';
import styles from './Icon.module.css';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  /** A lucide icon component, imported per icon: `import { Coffee } from 'lucide-react'`. */
  icon: LucideIcon;
  size?: Size;
} & (
  | {
      /** Decorative (default): hidden from assistive technology. Use next to visible text. */
      label?: undefined;
    }
  | {
      /** Standalone meaning: announced as an image with this name. */
      label: string;
    }
);

export function Icon({ icon: Glyph, size = 'md', label }: Props) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return <Glyph className={styles[size]} focusable="false" strokeWidth={2} {...a11y} />;
}
