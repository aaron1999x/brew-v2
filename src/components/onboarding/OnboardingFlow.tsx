'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { HandleField } from '@/components/auth/HandleField';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { GearPicker } from '@/components/gear/GearPicker';
import { AvatarUploader } from '@/components/profile/AvatarUploader';
import { UnitsFields } from '@/components/settings/UnitsFields';
import { Button } from '@/components/ui/Button/Button';
import { RadioGroup } from '@/components/ui/RadioGroup/RadioGroup';
import {
  FormErrorSummary,
  type FormError,
} from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { HANDLE_MESSAGES, useHandleStatus } from '@/lib/auth/handle';
import { toUserMessage } from '@/lib/errors/messages';
import { buildGearInput, missingPickMessage, type GearPick } from '@/lib/gear/form';
import { useAddGear, useGearCatalog } from '@/lib/gear/hooks';
import type { GearCategory } from '@/lib/recipes/gear';
import {
  EXPERIENCE_LEVELS,
  useProfileMe,
  useUpdateProfile,
  type ExperienceLevel,
  type ProfileMe,
} from '@/lib/profile/useProfileMe';
import { ONBOARDING_STEPS, welcomeSteps, type StepId } from '@/lib/settings/onboarding';
import { useSettings, useUpdateSettings, type Settings } from '@/lib/settings/useSettings';
import { deviceDefaults, type UnitSettings } from '@/lib/units';
import styles from './Onboarding.module.css';

type FlowStep = StepId | 'start';

/** /welcome: one step per screen, every step skippable. Steps and their order: `ONBOARDING_STEPS`. */
export function OnboardingFlow() {
  const settings = useSettings();
  const profile = useProfileMe();
  return (
    <QueryBoundary
      label="your account"
      isLoading={settings.isPending || profile.isPending}
      isError={settings.isError || profile.isError}
      onRetry={() => {
        void settings.refetch();
        void profile.refetch();
      }}
    >
      {settings.data && profile.data ? (
        <Flow settings={settings.data} profile={profile.data} />
      ) : null}
    </QueryBoundary>
  );
}

function Flow({ settings, profile }: { settings: Settings; profile: ProfileMe }) {
  // Fixed when the flow opens, so choosing a handle doesn't shift the step count under the person.
  const [steps] = useState<FlowStep[]>(() => [
    ...welcomeSteps({
      handleConfirmed: profile.handle_confirmed,
      hasExperienceLevel: profile.experience_level !== null,
    }),
    'start',
  ]);
  const [index, setIndex] = useState(0);
  const save = useUpdateSettings();
  const current = steps[index] ?? 'start';

  // Opening /welcome marks onboarding as started, so confirmation links stop sending people here.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || settings.onboarding.started_at) return;
    marked.current = true;
    save.mutate({ onboarding: { started_at: new Date().toISOString() } });
  }, [settings.onboarding, save]);

  function finish(step: StepId, status: 'done' | 'skipped') {
    save.mutate({ onboarding: { steps: { [step]: status } } });
    setIndex((i) => i + 1);
  }

  return (
    <section className={styles.card} aria-labelledby="welcome-title">
      <p className={styles.progress} data-testid="onboarding-progress">
        Step {index + 1} of {steps.length}
      </p>
      <div className={styles.bar} aria-hidden="true">
        <span className={styles.fill} style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>
      {current === 'start' ? (
        <StartStep />
      ) : (
        <>
          <h1 id="welcome-title" className={styles.title}>
            {ONBOARDING_STEPS[current].title}
          </h1>
          {current === 'handle' ? (
            <HandleStep
              onDone={() => finish('handle', 'done')}
              onSkip={() => finish('handle', 'skipped')}
            />
          ) : null}
          {current === 'units' ? (
            <UnitsStep
              onDone={(units) => {
                save.mutate({ ...units, onboarding: { steps: { units: 'done' } } });
                setIndex((i) => i + 1);
              }}
              onSkip={() => finish('units', 'skipped')}
            />
          ) : null}
          {current === 'gear' ? (
            <GearStep
              onDone={() => finish('gear', 'done')}
              onSkip={() => finish('gear', 'skipped')}
            />
          ) : null}
          {current === 'profile' ? (
            <ProfileStep
              profile={profile}
              current={profile.experience_level}
              onDone={() => finish('profile', 'done')}
              onSkip={() => finish('profile', 'skipped')}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function StepButtons({
  onSkip,
  continueButton,
}: {
  onSkip: () => void;
  continueButton: ReactNode;
}) {
  return (
    <div className={styles.buttons}>
      {continueButton}
      <Button variant="ghost" size="lg" onPress={onSkip}>
        Skip for now
      </Button>
    </div>
  );
}

function HandleStep({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [handle, setHandle] = useState('');
  const [errors, setErrors] = useState<FormError[]>([]);
  const { status, isChecking } = useHandleStatus(handle);
  const update = useUpdateProfile();

  const fieldId = 'onboarding-handle';

  /** The Continue button is always enabled; what is wrong is said here, on submit. */
  async function submit() {
    let message: string | undefined;
    if (handle === '') message = 'Pick a handle, or skip this step.';
    else if (isChecking || status === null) message = 'Wait for the handle check to finish.';
    else if (status !== 'ok') message = HANDLE_MESSAGES[status];
    if (message) {
      setErrors([{ fieldId, message }]);
      return;
    }
    setErrors([]);
    try {
      await update.mutateAsync({ handle });
      onDone();
    } catch (e) {
      setErrors([{ fieldId, message: toUserMessage(e) }]);
    }
  }

  return (
    <div className={styles.step}>
      <p className={styles.text}>Your handle is how other brewers will find you.</p>
      <FormErrorSummary errors={errors} />
      <HandleField
        id={fieldId}
        value={handle}
        onChange={setHandle}
        status={status}
        isChecking={isChecking}
        errorMessage={errors[0]?.message}
      />
      <StepButtons
        onSkip={onSkip}
        continueButton={
          <Button
            size="lg"
            isPending={update.isPending}
            pendingLabel="Saving…"
            onPress={() => void submit()}
          >
            Continue
          </Button>
        }
      />
    </div>
  );
}

function UnitsStep({
  onDone,
  onSkip,
}: {
  onDone: (units: UnitSettings) => void;
  onSkip: () => void;
}) {
  // Pre-filled from this device's locale; nothing is saved until Continue.
  const [units, setUnits] = useState<UnitSettings>(() => deviceDefaults());
  return (
    <div className={styles.step}>
      <p className={styles.text}>
        We guessed these from your device. Change anything that&apos;s off.
      </p>
      <UnitsFields value={units} onChange={(patch) => setUnits((u) => ({ ...u, ...patch }))} />
      <StepButtons
        onSkip={onSkip}
        continueButton={
          <Button size="lg" onPress={() => onDone(units)}>
            Continue
          </Button>
        }
      />
    </div>
  );
}

const GEAR_STEP_FIELDS: readonly { category: GearCategory; label: string; id: string }[] = [
  { category: 'brewer', label: 'Brewer', id: 'onboarding-brewer' },
  { category: 'grinder', label: 'Grinder', id: 'onboarding-grinder' },
];

/**
 * Brewer and grinder pickers (catalogue search or your own name). Continue saves what was chosen
 * as the default for each category; choosing nothing counts as skipping the step.
 */
function GearStep({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const catalog = useGearCatalog();
  const add = useAddGear();
  const [picks, setPicks] = useState<Partial<Record<GearCategory, GearPick | null>>>({});
  const [typed, setTyped] = useState<Partial<Record<GearCategory, string>>>({});
  const [errors, setErrors] = useState<FormError[]>([]);

  const fieldError = (id: string) => errors.find((e) => e.fieldId === id)?.message;

  async function submit() {
    const found: FormError[] = [];
    const toSave: { category: GearCategory; pick: GearPick }[] = [];
    for (const field of GEAR_STEP_FIELDS) {
      const pick = picks[field.category] ?? null;
      const text = typed[field.category] ?? '';
      if (pick) toSave.push({ category: field.category, pick });
      else if (text.trim()) found.push({ fieldId: field.id, message: missingPickMessage(text) });
    }
    setErrors(found);
    if (found.length > 0) return;
    if (toSave.length === 0) {
      onSkip();
      return;
    }
    try {
      for (const { category, pick } of toSave) {
        const result = buildGearInput({ category, pick, typed: '', nickname: '', notes: '' });
        if (!result.ok) continue;
        await add.mutateAsync({ ...result.input, is_default: true });
      }
      onDone();
    } catch {
      // The toast says what went wrong; stay here with the choices still made.
    }
  }

  return (
    <div className={styles.step}>
      <p className={styles.text}>
        Add your brewer and grinder so new recipes fill in automatically.
      </p>
      <FormErrorSummary errors={errors} />
      {GEAR_STEP_FIELDS.map((field) => (
        <GearPicker
          key={field.category}
          id={field.id}
          label={field.label}
          category={field.category}
          catalog={catalog.data ?? []}
          isLoading={catalog.isPending}
          value={picks[field.category] ?? null}
          onChange={(pick) => setPicks((p) => ({ ...p, [field.category]: pick }))}
          onTextChange={(text) => setTyped((t) => ({ ...t, [field.category]: text }))}
          errorMessage={fieldError(field.id)}
        />
      ))}
      <p className={styles.text}>Add more gear later in Settings.</p>
      <StepButtons
        onSkip={onSkip}
        continueButton={
          <Button
            size="lg"
            isPending={add.isPending}
            pendingLabel="Saving…"
            onPress={() => void submit()}
          >
            Continue
          </Button>
        }
      />
    </div>
  );
}

function ProfileStep({
  profile,
  current,
  onDone,
  onSkip,
}: {
  profile: ProfileMe;
  current: ExperienceLevel | null;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [level, setLevel] = useState<ExperienceLevel | null>(current);
  const update = useUpdateProfile();

  async function submit() {
    if (level) {
      try {
        await update.mutateAsync({ experience_level: level });
      } catch {
        return; // the toast already says what went wrong; stay on this step
      }
    }
    onDone();
  }

  return (
    <div className={styles.step}>
      <AvatarUploader profile={profile} />
      <RadioGroup
        label="How would you describe your brewing?"
        value={level ?? ''}
        onChange={(v) => setLevel(v as ExperienceLevel)}
        options={EXPERIENCE_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
      />
      <StepButtons
        onSkip={onSkip}
        continueButton={
          <Button
            size="lg"
            isPending={update.isPending}
            pendingLabel="Saving…"
            onPress={() => void submit()}
          >
            Continue
          </Button>
        }
      />
    </div>
  );
}

function StartStep() {
  const router = useRouter();
  return (
    <div className={styles.step}>
      <h1 id="welcome-title" className={styles.title}>
        You&apos;re all set
      </h1>
      <p className={styles.text}>Where would you like to start?</p>
      <div className={styles.buttons}>
        <Button size="lg" onPress={() => router.push('/recipes/new')}>
          Create first recipe
        </Button>
        <Button variant="secondary" size="lg" onPress={() => router.push('/verified')}>
          Browse verified recipes
        </Button>
        <Button variant="ghost" size="lg" onPress={() => router.push('/home')}>
          Look around
        </Button>
      </div>
    </div>
  );
}
