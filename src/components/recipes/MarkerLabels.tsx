'use client';

import { usePlotArea, useXAxisScale, useYAxisScale } from 'recharts';
import styles from './PourCurveChart.module.css';

export type MarkerLabel = { id: string; t: number; w: number; label: string };
export type LinePoint = { t: number; w: number };

type Box = { x0: number; x1: number; y0: number; y1: number };

/** Caption text is 12 px; this is a little wider than the real glyphs so boxes never touch. */
const CHAR_PX = 7;
const LINE_PX = 14;
const GAP = 9;
const LINE_PAD = 2;

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * The step names beside the markers. Each label is placed inside the plot area: to the right of its
 * marker, or to the left (text anchored at the end) when it would cross the right edge, and above or
 * below the marker. A label that would touch an earlier one tries the other spots, then stacks higher.
 */
export function MarkerLabels({
  items,
  line,
}: {
  items: readonly MarkerLabel[];
  /** The curve itself, so a name never sits on the line. */
  line: readonly LinePoint[];
}) {
  const area = usePlotArea();
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  if (!area || !xScale || !yScale || area.width <= 0 || area.height <= 0) return null;

  const left = area.x;
  const right = area.x + area.width;
  const top = area.y - 4;
  const bottom = area.y + area.height;

  const path = line.map((p) => ({ x: xScale(p.t) ?? 0, y: yScale(p.w) ?? 0 }));
  const hitsLine = (b: Box) => {
    for (let i = 1; i < path.length; i += 1) {
      const a = path[i - 1]!;
      const c = path[i]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(c.x - a.x, c.y - a.y) / 2));
      for (let k = 0; k <= steps; k += 1) {
        const x = a.x + ((c.x - a.x) * k) / steps;
        const y = a.y + ((c.y - a.y) * k) / steps;
        if (
          x > b.x0 - LINE_PAD &&
          x < b.x1 + LINE_PAD &&
          y > b.y0 - LINE_PAD &&
          y < b.y1 + LINE_PAD
        ) {
          return true;
        }
      }
    }
    return false;
  };

  // Every marker is an obstacle too, so a name does not cover another marker.
  const placed: Box[] = items.map((m) => {
    const x = xScale(m.t) ?? 0;
    const y = yScale(m.w) ?? 0;
    return { x0: x - 8, x1: x + 8, y0: y - 8, y1: y + 8 };
  });
  const out: { id: string; x: number; y: number; anchor: 'start' | 'end'; label: string }[] = [];

  const points = items
    .map((m) => ({ ...m, cx: xScale(m.t) ?? 0, cy: yScale(m.w) ?? 0 }))
    .sort((a, b) => a.cx - b.cx);

  for (const m of points) {
    const width = m.label.length * CHAR_PX;
    const candidates: { x: number; baseline: number; anchor: 'start' | 'end' }[] = [];
    for (const lift of [0, 1, 2, 3, 4, 5]) {
      candidates.push(
        { x: m.cx + GAP, baseline: m.cy - GAP - lift * LINE_PX, anchor: 'start' },
        { x: m.cx - GAP, baseline: m.cy - GAP - lift * LINE_PX, anchor: 'end' },
        { x: m.cx + GAP, baseline: m.cy + GAP + 10 + lift * LINE_PX, anchor: 'start' },
        { x: m.cx - GAP, baseline: m.cy + GAP + 10 + lift * LINE_PX, anchor: 'end' },
      );
    }
    const boxOf = (c: (typeof candidates)[number]): Box => {
      const x0 = c.anchor === 'start' ? c.x : c.x - width;
      return { x0, x1: x0 + width, y0: c.baseline - 12, y1: c.baseline + 3 };
    };
    const inside = (b: Box) => b.x0 >= left && b.x1 <= right && b.y0 >= top && b.y1 <= bottom;
    const free = (b: Box) => placed.every((p) => !overlaps(b, p));
    const clear = (c: (typeof candidates)[number]) => {
      const b = boxOf(c);
      return inside(b) && free(b) && !hitsLine(b);
    };
    // No clear spot (a very narrow chart): leave the name out rather than draw it over the line.
    // The legend and the data table still carry every step.
    const pick = candidates.find(clear);
    if (!pick) continue;
    placed.push(boxOf(pick));
    out.push({ id: m.id, x: pick.x, y: pick.baseline, anchor: pick.anchor, label: m.label });
  }

  return (
    <g aria-hidden="true" data-marker-labels="">
      {out.map((o) => (
        <text key={o.id} x={o.x} y={o.y} textAnchor={o.anchor} className={styles.markerLabel}>
          {o.label}
        </text>
      ))}
    </g>
  );
}
