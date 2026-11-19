'use client';

import { ArrowRight } from 'lucide-react';
import { ChangedPill } from '@/components/ui/Badge/Badge';
import { Icon } from '@/components/ui/Icon/Icon';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden/VisuallyHidden';
import {
  DIFF_SECTION_LABELS,
  type DiffSection,
  type DiffValue,
  type FieldChange,
  type StepChange,
  type ValueType,
  type VersionDiff,
} from '@/lib/recipes/diff';
import { formatRoastDate } from '@/lib/recipes/format';
import { useUnits } from '@/lib/settings/useSettings';
import { formatRate } from '@/lib/units';
import styles from './Changes.module.css';

const NOT_SET = 'Not set';

/** Turns a diff value into text in the person's units. The diff itself is always metric. */
export function useDiffFormatter() {
  const { units, weight, temp, duration } = useUnits();
  return (type: ValueType, value: DiffValue): string => {
    if (value === null) return NOT_SET;
    if (typeof value === 'string' && type !== 'date' && type !== 'text') return value;
    switch (type) {
      case 'weight':
        return weight(Number(value));
      case 'temperature':
        return temp(Number(value));
      case 'duration':
        return duration(Number(value));
      case 'rate':
        return formatRate(Number(value), units.weight_unit);
      case 'percent':
        return `${value}%`;
      case 'date':
        return formatRoastDate(String(value));
      default:
        return String(value);
    }
  };
}

function FromTo({ before, after }: { before: string; after: string }) {
  return (
    <span className={styles.fromTo}>
      <span className={styles.before}>
        <VisuallyHidden>From </VisuallyHidden>
        {before}
      </span>
      <Icon icon={ArrowRight} size="sm" />
      <span className={styles.after}>
        <VisuallyHidden>to </VisuallyHidden>
        {after}
      </span>
    </span>
  );
}

/** Changed fields: the name, a "Changed" marker (icon and word) and old → new. */
export function FieldChanges({ fields }: { fields: readonly FieldChange[] }) {
  const format = useDiffFormatter();
  return (
    <ul className={styles.list}>
      {fields.map((f) => (
        <li key={f.key} className={styles.item} data-changed={f.key}>
          <span className={styles.name}>{f.label}</span>
          <ChangedPill />
          <FromTo before={format(f.type, f.before)} after={format(f.type, f.after)} />
        </li>
      ))}
    </ul>
  );
}

function stepSentence(change: StepChange): string {
  switch (change.change) {
    case 'added':
      return `added as step ${change.toPosition}`;
    case 'removed':
      return `removed (was step ${change.fromPosition})`;
    case 'moved':
      return `moved from step ${change.fromPosition} to step ${change.toPosition}`;
    default:
      return change.moved
        ? `changed, and moved from step ${change.fromPosition} to step ${change.toPosition}`
        : 'changed';
  }
}

/** Changed steps, matched by id: added, removed, moved, and field-level changes ("Weight 100 g → 110 g"). */
export function StepChanges({ steps }: { steps: readonly StepChange[] }) {
  const format = useDiffFormatter();
  return (
    <ul className={styles.list}>
      {steps.map((s) => (
        <li key={s.id} className={styles.item} data-changed={`steps.${s.id}`}>
          <span className={styles.name}>{s.label}</span>
          <ChangedPill />
          <span className={styles.sentence}>{stepSentence(s)}</span>
          {s.fields.length > 0 ? (
            <ul className={styles.nested}>
              {s.fields.map((f) => (
                <li key={f.key} className={styles.nestedItem}>
                  <span className={styles.nestedName}>{f.label}</span>
                  <FromTo before={format(f.type, f.before)} after={format(f.type, f.after)} />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

const SECTION_ORDER: readonly DiffSection[] = [
  'basics',
  'gear',
  'coffee',
  'numbers',
  'steps',
  'targets',
  'notes',
];

/**
 * Every section of a diff in the recipe page's order. A changed section lists what changed; an
 * unchanged one is collapsed to "No changes".
 */
export function DiffSections({ diff }: { diff: VersionDiff }) {
  return (
    <div className={styles.sections}>
      {SECTION_ORDER.map((section) => {
        const info = diff.sections[section];
        const title = DIFF_SECTION_LABELS[section];
        if (!info.changed) {
          return (
            <section key={section} className={styles.section} aria-label={title}>
              <h3 className={styles.sectionTitle}>
                {title} <span className={styles.none}>No changes</span>
              </h3>
            </section>
          );
        }
        return (
          <section key={section} className={styles.section} aria-label={title}>
            <h3 className={styles.sectionTitle}>
              {title} <span className={styles.count}>{info.count} changed</span>
            </h3>
            {section === 'steps' ? (
              <StepChanges steps={diff.steps} />
            ) : (
              <FieldChanges fields={diff.fields.filter((f) => f.section === section)} />
            )}
          </section>
        );
      })}
    </div>
  );
}
