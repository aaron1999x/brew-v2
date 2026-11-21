'use client';

import { ArrowDown, ArrowUp, CircleCheck, type LucideIcon } from 'lucide-react';
import { Icon } from '@/components/ui/Icon/Icon';
import { formatRatio } from '@/lib/recipes/calc';
import { TARGET_STATUS_LABEL, targetRangeText, type TargetStatus } from '@/lib/brews/targets';
import type { ExtractionModel } from '@/lib/brews/extraction';
import { useUnits } from '@/lib/settings/useSettings';
import styles from './ExtractionPanel.module.css';

const STATUS_ICON: Record<TargetStatus, LucideIcon> = {
  in: CircleCheck,
  below: ArrowDown,
  above: ArrowUp,
};

type CellProps = {
  label: string;
  value: string;
  status?: TargetStatus | null;
  target?: string | null;
  note?: string;
};

function Cell({ label, value, status, target, note }: CellProps) {
  return (
    <div className={styles.cell} data-status={status ?? undefined}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
      {status ? (
        <dd className={styles.status}>
          <Icon icon={STATUS_ICON[status]} size="sm" />
          <span>
            {TARGET_STATUS_LABEL[status]}
            {target ? ` (${target})` : ''}
          </span>
        </dd>
      ) : target ? (
        <dd className={styles.sub}>Target {target}</dd>
      ) : note ? (
        <dd className={styles.sub}>{note}</dd>
      ) : null}
    </div>
  );
}

/**
 * The computed results: brew ratio, overall ratio (with bypass), extraction yield, TDS and drawdown,
 * each of the last three against the version's target with an icon and words, never colour alone.
 */
export function ExtractionPanel({
  model,
  showDrawdown = true,
  label = 'Extraction',
}: Readonly<{ model: ExtractionModel; showDrawdown?: boolean; label?: string }>) {
  const { duration } = useUnits();
  const pct = (n: number) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n)}%`;
  const t = model.targets;
  // "19–21%": the unit once, after the range.
  const pctRange = (min: number | null, max: number | null) =>
    min != null && max != null && min !== max
      ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(min)}–${pct(max)}`
      : targetRangeText(min, max, pct);
  const dash = '—';
  return (
    <dl className={styles.panel} aria-label={label}>
      <Cell label="Brew ratio" value={formatRatio(model.ratio) ?? dash} />
      {model.hasBypass ? (
        <Cell label="Overall ratio" value={formatRatio(model.overall) ?? dash} note="with bypass" />
      ) : null}
      <Cell
        label="Extraction"
        value={model.ey == null ? dash : pct(model.ey)}
        status={model.eyStatus}
        target={pctRange(t.eyMin, t.eyMax)}
      />
      <Cell
        label="TDS"
        value={model.tds == null ? dash : pct(model.tds)}
        status={model.tdsStatus}
        target={pctRange(t.tdsMin, t.tdsMax)}
      />
      {showDrawdown ? (
        <Cell
          label="Drawdown"
          value={model.drawdownS == null ? dash : duration(model.drawdownS)}
          status={model.drawdownStatus}
          target={targetRangeText(t.drawdownMinS, t.drawdownMaxS, duration)}
        />
      ) : null}
    </dl>
  );
}
