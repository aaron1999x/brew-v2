'use client';

import { Archive, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Badge, VersionBadge, VisibilityBadge } from '@/components/ui/Badge/Badge';
import { Icon } from '@/components/ui/Icon/Icon';
import { Notice } from '@/components/ui/Notice/Notice';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden/VisuallyHidden';
import type { RecipeRow, VersionRow } from '@/lib/recipes/fetch';
import { formatRange, formatRoastDate } from '@/lib/recipes/format';
import { GEAR_CATEGORY_LABELS, RECIPE_GEAR_CATEGORIES } from '@/lib/recipes/gear';
import { ROAST_LEVEL_LABELS, methodLabel } from '@/lib/recipes/methods';
import { STEP_KIND_LABELS, pourDeltas, stepLabel, type StepData } from '@/lib/recipes/steps';
import { useUnits } from '@/lib/settings/useSettings';
import { formatRate } from '@/lib/units';
import { KeyNumbers } from './KeyNumbers';
import { LazyPourCurve } from './LazyPourCurve';
import styles from './RecipePage.module.css';

/** The side column's distance from the top of the window while it sticks (matches the CSS). */
const STICKY_GAP_PX = 16;

function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  if (children == null || children === '') return null;
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

type Props = Readonly<{
  recipe: RecipeRow;
  version: VersionRow;
  /** How many versions the recipe has: "v3 of 5". */
  versionCount: number;
  /** Where the back arrow goes. */
  backHref: string;
  /** Shown under the badges: the version switcher. */
  switcher?: ReactNode;
  /** Owner actions, kept out of this component so a public page can render the same view. */
  actions?: ReactNode;
  /** A line above the details, e.g. "You're looking at v2; the latest is v5". */
  notice?: ReactNode;
  /** Move focus to the heading on arrival (a page reached after saving or by navigation). */
  focusHeading?: boolean;
}>;

/**
 * One recipe version as a read-only page. It takes plain data and renders no owner controls of its
 * own (those arrive through `switcher` and `actions`), so the public recipe page can reuse it.
 */
export function RecipeView({
  recipe,
  version,
  versionCount,
  backHref,
  switcher,
  actions,
  notice,
  focusHeading = true,
}: Props) {
  const { date } = useUnits();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const [sideFits, setSideFits] = useState(false);

  // The side column sticks while the main column scrolls, but only when it is shorter than the
  // window: a taller one would hide its lower part.
  useEffect(() => {
    const el = sideRef.current;
    if (!el) return;
    const measure = () => setSideFits(el.offsetHeight <= window.innerHeight - STICKY_GAP_PX * 2);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [version.id]);

  // Arriving here after a save (or a link): the heading is where a screen reader starts.
  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading, version.id]);

  const grinder = version.gear.grinder?.name;
  const drawdown =
    version.drawdown_min_s != null || version.drawdown_max_s != null
      ? {
          from: version.drawdown_min_s ?? version.drawdown_max_s ?? 0,
          to: version.drawdown_max_s ?? version.drawdown_min_s ?? 0,
        }
      : null;

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <Link href={backHref} aria-label="Back" className={styles.back} data-primary-control="">
          <Icon icon={ChevronLeft} size="md" />
        </Link>
        <div className={styles.headerText}>
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            {recipe.name}
          </h1>
          <div className={styles.badges}>
            <Badge>{methodLabel(recipe.method, recipe.method_custom)}</Badge>
            {versionCount > 1 ? (
              <Badge>{`v${version.version_no} of ${versionCount}`}</Badge>
            ) : (
              <VersionBadge version={version.version_no} />
            )}
            <VisibilityBadge visibility={recipe.visibility} />
            {recipe.archived_at ? (
              <Badge tone="warning" icon={Archive}>
                Archived
              </Badge>
            ) : null}
          </div>
          <p className={styles.muted}>Last edited {date(recipe.edited_at)}</p>
        </div>
      </header>

      {switcher}
      {actions}
      <div className={styles.columns}>
        {notice || version.locked_at || version.change_note ? (
          <div className={styles.versionInfo}>
            <h2 className={styles.versionTitle}>This version</h2>
            {notice}
            {version.locked_at ? (
              <Notice>This version has brews. Changes save as a new version.</Notice>
            ) : null}
            {version.change_note ? (
              <p className={styles.changeNote}>
                <span className={styles.muted}>Change note: </span>
                {version.change_note}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className={styles.mainColumn}>
          <KeyNumbers version={version} grinderName={grinder} />

          {version.steps.length > 0 ? (
            <LazyPourCurve
              series={[{ id: version.id, label: `v${version.version_no}`, steps: version.steps }]}
              drawdown={drawdown}
            />
          ) : null}

          <Steps steps={version.steps} />
        </div>

        <div
          ref={sideRef}
          className={styles.sideColumn}
          data-sticky={sideFits ? 'true' : undefined}
        >
          <CoffeeSection version={version} />

          <GearSection version={version} />

          <TargetsSection version={version} />

          {version.notes ? (
            <Section title="Notes">
              <p className={styles.notes}>{version.notes}</p>
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Steps({ steps }: { steps: StepData[] }) {
  const { units, weight, temp, duration } = useUnits();
  if (steps.length === 0) {
    return (
      <Section title="Steps">
        <p className={styles.muted}>No steps. The timer will be a simple stopwatch.</p>
      </Section>
    );
  }
  const deltas = pourDeltas(steps);
  return (
    <Section title="Steps">
      <ol className={styles.steps}>
        {steps.map((step, index) => {
          const delta = deltas.get(step.id);
          const details = [
            step.kind === 'pour' && step.target_g != null
              ? `to ${weight(step.target_g)}${delta != null ? ` (+${weight(delta)})` : ''}`
              : null,
            step.kind === 'pour' && step.rate_gps != null
              ? formatRate(step.rate_gps, units.weight_unit)
              : null,
            step.kind === 'pour' && step.temp_c != null ? temp(step.temp_c) : null,
            step.kind !== 'pour' && step.duration_s != null
              ? `for ${duration(step.duration_s)}`
              : null,
          ].filter(Boolean);
          return (
            <li key={step.id} className={styles.step}>
              <span className={`${styles.time} num`}>{duration(step.at_s)}</span>
              <div>
                <p className={styles.stepName}>
                  <VisuallyHidden>{`Step ${index + 1}: `}</VisuallyHidden>
                  {step.kind === 'other' ? stepLabel(steps, index) : STEP_KIND_LABELS[step.kind]}
                  {details.length > 0 ? <span className="num"> {details.join(' · ')}</span> : null}
                </p>
                {step.technique ? <p className={styles.technique}>{step.technique}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function CoffeeSection({ version }: { version: VersionRow }) {
  const any =
    version.coffee_name ||
    version.roaster ||
    version.origin ||
    version.process ||
    version.varietal ||
    version.altitude_m != null ||
    version.roast_level ||
    version.roast_date ||
    version.colour_reading != null;
  if (!any) return null;
  return (
    <Section title="Coffee">
      <dl className={styles.list}>
        <Row label="Coffee">{version.coffee_name}</Row>
        <Row label="Roaster">{version.roaster}</Row>
        <Row label="Origin">{version.origin}</Row>
        <Row label="Process">{version.process}</Row>
        <Row label="Varietal">{version.varietal}</Row>
        <Row label="Altitude">{version.altitude_m != null ? `${version.altitude_m} m` : null}</Row>
        <Row label="Roast">
          {version.roast_level ? ROAST_LEVEL_LABELS[version.roast_level] : null}
        </Row>
        <Row label="Roasted">{version.roast_date ? formatRoastDate(version.roast_date) : null}</Row>
        <Row label="Roast colour">
          {version.colour_reading != null
            ? `${version.colour_reading}${version.colour_scale ? ` (${version.colour_scale})` : ''}`
            : null}
        </Row>
      </dl>
    </Section>
  );
}

function GearSection({ version }: { version: VersionRow }) {
  const entries = RECIPE_GEAR_CATEGORIES.filter((c) => version.gear[c]);
  if (entries.length === 0 && version.water_ppm == null) return null;
  return (
    <Section title="Gear">
      <dl className={styles.list}>
        {entries.map((category) => (
          <Row key={category} label={GEAR_CATEGORY_LABELS[category]}>
            {version.gear[category]?.name}
          </Row>
        ))}
        <Row label="Water">{version.water_ppm != null ? `${version.water_ppm} ppm` : null}</Row>
      </dl>
    </Section>
  );
}

function TargetsSection({ version }: { version: VersionRow }) {
  const { duration } = useUnits();
  const drawdown = formatRange(version.drawdown_min_s, version.drawdown_max_s, duration);
  const tds = formatRange(version.tds_min, version.tds_max, (n) => `${n}%`);
  const ey = formatRange(version.ey_min, version.ey_max, (n) => `${n}%`);
  if (!drawdown && !tds && !ey) return null;
  return (
    <Section title="Targets">
      <dl className={styles.list}>
        <Row label="Drawdown">{drawdown}</Row>
        <Row label="TDS">{tds}</Row>
        <Row label="Extraction">{ey}</Row>
      </dl>
    </Section>
  );
}
