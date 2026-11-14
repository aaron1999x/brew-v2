'use client';

import { useEffect, useState } from 'react';

export type ViewportBox = { height: number; offsetTop: number };

/**
 * The part of the screen you can actually see: on iPhone the on-screen keyboard shrinks the
 * visual viewport but not the layout viewport (Safari ignores `interactive-widget`), so fixed
 * elements sized to the page end up behind the keyboard. Null where `visualViewport` is missing
 * or before the first measurement; callers then rely on plain CSS (`100dvh`).
 */
export function useVisualViewport(enabled = true): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) return;
    const update = () => setBox({ height: viewport.height, offsetTop: viewport.offsetTop });
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      setBox(null);
    };
  }, [enabled]);

  return box;
}
