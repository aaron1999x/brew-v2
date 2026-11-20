'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { VersionBadge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { Switch } from '@/components/ui/Switch/Switch';
import { unlockAudio } from '@/lib/brews/audio';
import { stepKindName } from '@/lib/brews/describe';
import { logTimerEvent } from '@/lib/brews/events';
import { applyQuickChange, changedFields } from '@/lib/brews/quick-change';
import type { BrewSession, QuickChange, SessionVersion } from '@/lib/brews/schema';
import { nextVersionNo, withTimer } from '@/lib/brews/sessions';
import { reduce } from '@/lib/brews/timer';
import { useCanVibrate, useTimerPrefs } from '@/lib/brews/useDeviceFeatures';
import { brewRatio, formatRatio } from '@/lib/recipes/calc';
import { versionPath } from '@/lib/recipes/paths';
import { hasPourTemperatures, totalTimeS } from '@/lib/recipes/steps';
import { useUnits } from '@/lib/settings/useSettings';
import { QuickChangePanel } from '../QuickChangePanel';
import { FlipClock } from './FlipClock';
import { ScrollRow } from './ScrollRow';
import { SoundPill } from './SoundPill';
import styles from './timer.module.css';

type Props = Readonly<{
  session: BrewSession;
  update: (change: (s: BrewSession) => BrewSession) => BrewSession | null;
}>;

export type SummaryItem = { text: string; was?: string };

/** The prototype's help line, adapted to what this kind of brew does. */
function helpText(mode: 'guided' | 'steep' | 'stopwatch'): string {
  if (mode === 'steep') {
    return 'No count-in for a long steep. You can leave: Home shows when it ends, and it beeps for each step while the app is open.';
  }
  if (mode === 'stopwatch') {
    return '5 s count-in, then a stopwatch. Screen stays awake while running.';
  }
  return '5 s count-in before the brew clock. Beeps 5 s before each pour (a soft pip for other steps). Screen stays awake while running.';
}

/**
 * Before the brew, as in the prototype's Ready state: the total time as a big clock, a two-row
 * summary of the numbers, the steps as compact chips, "Change for this brew", the help line and a
 * big Start. The sections are spread over the screen; if there are too many for it, the content
 * scrolls above the Start button, never under it. The Sound pill is in the top bar, like on the
 * running screen. Start also turns audio on, as iOS needs a tap for that.
 */
export function PrepScreen({ session, update }: Props) {
  const router = useRouter();
  const { weight, temp, duration } = useUnits();
  const { prefs, setPrefs } = useTimerPrefs();
  const canVibrate = useCanVibrate();
  const base = session.version;
  const applied = useMemo(
    () => applyQuickChange(base, session.quickChange),
    [base, session.quickChange],
  );
  const changes = useMemo(() => changedFields(base, session.quickChange), [base, session.quickChange]);
  const changed = new Set<string>(changes.map((c) => c.field));
  const mode = session.timer?.mode ?? 'guided';
  const varies = hasPourTemperatures(applied.steps);
  const total = totalTimeS(applied.steps) ?? 0;

  const rows = summaryRows(applied, base, changed, { weight, temp });

  function setChange(change: QuickChange | null) {
    update((s) => ({ ...s, quickChange: change }));
  }

  function start() {
    // Audio can only start from a tap, so this runs first, inside the press.
    if (prefs.sound) void unlockAudio();
    const now = Date.now();
    update((s) => (s.timer ? withTimer(s, reduce(s.timer, { type: 'START', now })) : s));
    logTimerEvent('timer_started', session);
  }

  return (
    <div className={styles.screen}>
      <div className={styles.top}>
        <IconButton
          icon={ArrowLeft}
          label="Back to recipe"
          variant="ghost"
          onPress={() => router.push(versionPath(session.handle, session.slug, session.versionNo))}
        />
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>
            <span className={styles.titleText}>{session.recipeName}</span>
            <VersionBadge version={session.versionNo} />
          </h1>
        </div>
        <SoundPill on={prefs.sound} onToggle={() => setPrefs({ sound: !prefs.sound })} />
      </div>

      <div className={styles.prepScroll}>
        <div className={styles.ready}>
          <p className={styles.clockLabel}>Ready</p>
          <span className={styles.prepClock}>
            <FlipClock seconds={total} label="Total brew time" />
          </span>
        </div>

        <div className={styles.summary}>
          {rows.map((row, r) =>
            row.length === 0 ? null : (
              <p key={r} className={styles.summaryRow}>
                {row.map((item, i) => (
                  <span key={i} className={styles.summaryItem}>
                    {item.text}
                    {item.was ? <span className={styles.was}> (changed, was {item.was})</span> : null}
                  </span>
                ))}
              </p>
            ),
          )}
        </div>

        {applied.steps.length > 0 ? (
          <section aria-labelledby="prep-steps">
            <h2 id="prep-steps" className={styles.sectionTitle}>
              Steps{varies ? ' · temperature varies by pour' : ''}
            </h2>
            <ScrollRow label="Steps">
              {applied.steps.map((step) => {
                const pour = step.kind === 'pour' && step.target_g != null;
                const stepTemp = step.temp_c ?? applied.temp_c;
                return (
                  <li
                    key={step.id}
                    className={`${styles.stepChip} ${pour ? '' : styles.stepChipOther}`}
                  >
                    <span className={styles.stepTime}>{duration(step.at_s)}</span>
                    <span className={styles.stepMain}>
                      {pour ? weight(step.target_g as number) : stepKindName(step)}
                    </span>
                    {pour && varies && stepTemp != null ? (
                      <span className={styles.stepSub}>{temp(stepTemp)}</span>
                    ) : null}
                    {!pour && step.duration_s ? (
                      <span className={styles.stepSub}>{duration(step.duration_s)}</span>
                    ) : null}
                  </li>
                );
              })}
            </ScrollRow>
          </section>
        ) : (
          <p className={styles.help}>This recipe has no steps, so you&apos;ll get a stopwatch.</p>
        )}

        <QuickChangePanel
          base={base}
          change={session.quickChange}
          onChange={setChange}
          nextVersionNo={nextVersionNo(session)}
        />

        <div className={styles.options}>
          {canVibrate ? (
            <Switch isSelected={prefs.vibration} onChange={(vibration) => setPrefs({ vibration })}>
              Vibration
            </Switch>
          ) : null}
          <p className={styles.help}>{helpText(mode)}</p>
        </div>
      </div>

      <div className={styles.prepFooter}>
        <Button size="lg" fullWidth onPress={start}>
          {mode === 'steep' ? 'Start steep' : 'Start'}
        </Button>
      </div>
    </div>
  );
}

/**
 * The numbers as two rows. Row one: dose, water, ratio ("16.5 g · 170 g · 1:10.3"). Row two:
 * temperature, the grind SETTING (with its size in µm when there is one) and the grinder's name
 * ("92 °C · Grind 7.5 · 1Zpresso K-Ultra", or "Grind not set" when there is no setting). A value
 * changed with "Change for this brew" shows the version's own value beside it.
 */
export function summaryRows(
  applied: SessionVersion,
  base: SessionVersion,
  changed: ReadonlySet<string>,
  fmt: { weight: (g: number) => string; temp: (c: number) => string },
): [SummaryItem[], SummaryItem[]] {
  const first: SummaryItem[] = [
    { text: fmt.weight(applied.dose_g), was: changed.has('dose') ? fmt.weight(base.dose_g) : undefined },
    {
      text: fmt.weight(applied.brew_water_g),
      was: changed.has('water') ? fmt.weight(base.brew_water_g) : undefined,
    },
  ];
  const ratio = formatRatio(brewRatio(applied.dose_g, applied.brew_water_g));
  if (ratio) first.push({ text: ratio });

  const second: SummaryItem[] = [];
  if (applied.temp_c != null) {
    second.push({
      text: fmt.temp(applied.temp_c),
      was: changed.has('temp') && base.temp_c != null ? fmt.temp(base.temp_c) : undefined,
    });
  }
  const setting = applied.grind_setting?.trim() || null;
  const microns = applied.grind_microns != null ? `${applied.grind_microns} µm` : null;
  if (setting || microns || applied.grinder) {
    const grind = setting ? (microns ? `${setting} (${microns})` : setting) : (microns ?? 'not set');
    second.push({
      text: `Grind ${grind}`,
      was: changed.has('grind') ? base.grind_setting?.trim() || 'not set' : undefined,
    });
  }
  if (applied.grinder) second.push({ text: applied.grinder });
  return [first, second];
}
