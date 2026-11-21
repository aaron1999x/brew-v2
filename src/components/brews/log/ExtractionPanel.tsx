'use client';

import { ArrowDown, ArrowUp, CircleCheck, type LucideIcon } from 'lucide-react';
import { Icon } from '@/components/ui/Icon/Icon';
import { formatRatio } from '@/lib/recipes/calc';
import { TARGET_STATUS_LABEL, targetRangeText, type TargetStatus } from '@/lib/brews/targets';
import type { ExtractionModel } from '@/lib/brews/extraction';
import styles from './ExtractionPanel.module.css';

const STATUS_ICON: Record<TargetStatus, LucideIcon> = {
  in: CircleCheck,
  below: ArrowDown,
  above: ArrowUp,
};

/**
 * "In range · 1.38–1.45", "Below · 2:45–3:15", or "Target 1.3–1.5" before there is a value: where a
 * measured value stands against its target, with an icon and words (never colour alone). Nothing
 * when the version has no target.
 */
export function TargetNote({
  status,
  range,
}: Readonly<{ status: TargetStatus | null; range: string | null }>) {
  if (status) {
    return (
      <p className={styles.note} data-status={status}>
        <Icon icon={STATUS_ICON[status]} size="sm" />
        <span>
          {TARGET_STATUS_LABEL[status]}
          {range ? ` · ${range}` : ''}
        </span>
      </p>
    );
  }
  return range ? <p className={styles.noteMuted}>Target {range}</p> : null;
}

const number = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

/** The target ranges of the three measured values, as text. */
export function targetTexts(model: ExtractionModel, duration: (seconds: number) => string) {
  const t = model.targets;
  return {
    tds: targetRangeText(t.tdsMin, t.tdsMax, number),
    ey: targetRangeText(t.eyMin, t.eyMax, number),
    drawdown: targetRangeText(t.drawdownMinS, t.drawdownMaxS, duration),
  };
}

/**
 * The three tiles in one row: brew ratio, overall ratio (with bypass; the same as the brew ratio
 * without) and extraction yield against its target. TDS and drawdown show their status under their
 * own inputs.
 */
export function ExtractionPanel({
  model,
  label = 'Extraction',
}: Readonly<{ model: ExtractionModel; label?: string }>) {
  const dash = '—';
  const t = model.targets;
  // "19–21%": the unit once, after the range.
  const range =
    t.eyMin != null && t.eyMax != null && t.eyMin !== t.eyMax
      ? `${number(t.eyMin)}–${number(t.eyMax)}%`
      : targetRangeText(t.eyMin, t.eyMax, (n) => `${number(n)}%`);
  return (
    <dl className={styles.panel} aria-label={label}>
      <div className={styles.cell}>
        <dt className={styles.label}>Brew ratio</dt>
        <dd className={styles.value}>{formatRatio(model.ratio) ?? dash}</dd>
      </div>
      <div className={styles.cell}>
        <dt className={styles.label}>Overall ratio</dt>
        <dd className={styles.value}>{formatRatio(model.overall) ?? dash}</dd>
        <dd className={styles.sub}>{model.hasBypass ? 'with bypass' : 'no bypass'}</dd>
      </div>
      <div className={styles.cell} data-status={model.eyStatus ?? undefined}>
        <dt className={styles.label}>Extraction</dt>
        <dd className={styles.value}>{model.ey == null ? dash : `${number(model.ey)}%`}</dd>
        <dd className={styles.sub}>
          <TargetNote status={model.eyStatus} range={range} />
        </dd>
      </div>
    </dl>
  );
}
