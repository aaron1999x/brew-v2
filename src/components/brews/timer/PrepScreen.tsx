'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { VersionBadge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { Switch } from '@/components/ui/Switch/Switch';
import { stepKindName } from '@/lib/brews/describe';
import { logTimerEvent } from '@/lib/brews/events';
import { unlockAudio } from '@/lib/brews/audio';
import { changedFields, applyQuickChange } from '@/lib/brews/quick-change';
import type { BrewSession, QuickChange } from '@/lib/brews/schema';
import { withTimer } from '@/lib/brews/sessions';
import { nextVersionNo } from '@/lib/brews/sessions';
import { reduce } from '@/lib/brews/timer';
import { useCanVibrate, useTimerPrefs } from '@/lib/brews/useDeviceFeatures';
import { brewRatio, formatRatio } from '@/lib/recipes/calc';
import { versionPath } from '@/lib/recipes/paths';
import { pourDeltas, stepHeading, type StepData } from '@/lib/recipes/steps';
import { useUnits } from '@/lib/settings/useSettings';
import { formatRate } from '@/lib/units';
import { QuickChangePanel } from '../QuickChangePanel';
import styles from './timer.module.css';

type Props = Readonly<{
  session: BrewSession;
  update: (change: (s: BrewSession) => BrewSession) => BrewSession | null;
}>;

/**
 * Before the brew: the recipe at a glance, the steps, "Change for this brew", the sound and
 * vibration switches, and Start (which also turns audio on, as iOS needs a tap for that).
 */
export function PrepScreen({ session, update }: Props) {
  const router = useRouter();
  const { weight, temp, duration, units } = useUnits();
  const { prefs, setPrefs } = useTimerPrefs();
  const canVibrate = useCanVibrate();
  const base = session.version;
  const applied = useMemo(
    () => applyQuickChange(base, session.quickChange),
    [base, session.quickChange],
  );
  const changes = useMemo(() => changedFields(base, session.quickChange), [base, session.quickChange]);
  const changedFieldNames = new Set(changes.map((c) => c.field));
  const steep = session.timer?.mode === 'steep';
  const ratio = formatRatio(brewRatio(applied.dose_g, applied.brew_water_g));
  const deltas = pourDeltas(applied.steps);

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
        <h1 className={styles.title}>
          {session.recipeName} <VersionBadge version={session.versionNo} />
        </h1>
      </div>

      <dl className={styles.numbers} aria-label="Key numbers">
        <KeyNumber label="Dose" value={weight(applied.dose_g)} was={changedFieldNames.has('dose') ? weight(base.dose_g) : null} />
        <KeyNumber
          label="Water"
          value={weight(applied.brew_water_g)}
          was={changedFieldNames.has('water') ? weight(base.brew_water_g) : null}
        />
        <KeyNumber label="Ratio" value={ratio ?? '—'} />
        <KeyNumber
          label="Temperature"
          value={applied.temp_c == null ? '—' : temp(applied.temp_c)}
          was={changedFieldNames.has('temp') && base.temp_c != null ? temp(base.temp_c) : null}
        />
        <KeyNumber
          label="Grind"
          value={[applied.grind_setting, base.grinder].filter(Boolean).join(' · ') || '—'}
          was={changedFieldNames.has('grind') ? (base.grind_setting ?? '—') : null}
        />
      </dl>

      <QuickChangePanel
        base={base}
        change={session.quickChange}
        onChange={setChange}
        nextVersionNo={nextVersionNo(session)}
      />

      {applied.steps.length > 0 ? (
        <section aria-labelledby="prep-steps" className={styles.section}>
          <h2 id="prep-steps" className={styles.sectionTitle}>
            Steps
          </h2>
          <ol className={styles.stepList}>
            {applied.steps.map((step, i) => (
              <li key={step.id} className={styles.stepItem}>
                <span className={styles.stepHead}>{stepHeading(applied.steps, i).visible}</span>
                <span className={styles.stepDetail}>
                  {stepDetail(step, deltas.get(step.id), applied.temp_c, { weight, temp, duration, rate: (g) => formatRate(g, units.weight_unit) })}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className={styles.hint}>This recipe has no steps, so you&apos;ll get a stopwatch.</p>
      )}

      <div className={styles.toggles}>
        <Switch isSelected={prefs.sound} onChange={(sound) => setPrefs({ sound })}>
          Sound
        </Switch>
        {canVibrate ? (
          <Switch isSelected={prefs.vibration} onChange={(vibration) => setPrefs({ vibration })}>
            Vibration
          </Switch>
        ) : null}
      </div>

      <div className={styles.controls}>
        <Button size="lg" fullWidth onPress={start}>
          {steep ? 'Start steep' : 'Start'}
        </Button>
      </div>
    </div>
  );
}

function KeyNumber({ label, value, was }: Readonly<{ label: string; value: string; was?: string | null }>) {
  return (
    <div className={styles.number}>
      <dt>{label}</dt>
      <dd>
        {value}
        {was ? <span className={styles.was}>changed, was {was}</span> : null}
      </dd>
    </div>
  );
}

type Fmt = {
  weight: (g: number) => string;
  temp: (c: number) => string;
  duration: (s: number) => string;
  rate: (gps: number) => string;
};

/** "Pour to 150 g (+70 g) · 95 °C · 3.5 g/s · Bloom" for the step list. */
export function stepDetail(
  step: StepData,
  delta: number | undefined,
  baseTempC: number | null,
  fmt: Fmt,
): string {
  const parts: string[] = [];
  if (step.kind === 'pour' && step.target_g != null) {
    parts.push(`Pour to ${fmt.weight(step.target_g)}${delta != null ? ` (+${fmt.weight(delta)})` : ''}`);
    const t = step.temp_c ?? baseTempC;
    if (step.temp_c != null && t != null) parts.push(fmt.temp(t));
    if (step.rate_gps != null) parts.push(fmt.rate(step.rate_gps));
  } else {
    parts.push(stepKindName(step));
    if (step.duration_s) parts.push(`for ${fmt.duration(step.duration_s)}`);
  }
  if (step.technique) parts.push(step.technique);
  return parts.join(' · ');
}
