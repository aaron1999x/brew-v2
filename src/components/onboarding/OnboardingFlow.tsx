'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { HandleField } from '@/components/auth/HandleField';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { AvatarUploader } from '@/components/profile/AvatarUploader';
import { UnitsFields } from '@/components/settings/UnitsFields';
import { Button } from '@/components/ui/Button/Button';
import { RadioGroup } from '@/components/ui/RadioGroup/RadioGroup';
import { useHandleStatus } from '@/lib/auth/handle';
import { toUserMessage } from '@/lib/errors/messages';
import {
  EXPERIENCE_LEVELS,
  useProfileMe,
  useUpdateProfile,
  type ExperienceLevel,
  type ProfileMe,
} from '@/lib/profile/useProfileMe';
import {
  ONBOARDING_STEPS,
  mergeOnboarding,
  welcomeSteps,
  type StepId,
} from '@/lib/settings/onboarding';
import { useSettings, useUpdateSettings, type Settings } from '@/lib/settings/useSettings';
import { deviceDefaults, type UnitSettings } from '@/lib/units';
import styles from './Onboarding.module.css';

type FlowStep = StepId | 'start';

/** /welcome: one step per screen, every step skippable. Gear is hidden by `ONBOARDING_STEPS`. */
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
    save.mutate({
      onboarding: mergeOnboarding(settings.onboarding, { started_at: new Date().toISOString() }),
    });
  }, [settings.onboarding, save]);

  function finish(step: StepId, status: 'done' | 'skipped') {
    save.mutate({
      onboarding: mergeOnboarding(settings.onboarding, { steps: { [step]: status } }),
    });
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
                save.mutate({
                  ...units,
                  onboarding: mergeOnboarding(settings.onboarding, { steps: { units: 'done' } }),
                });
                setIndex((i) => i + 1);
              }}
              onSkip={() => finish('units', 'skipped')}
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
  const [error, setError] = useState<string | undefined>();
  const { status, isChecking } = useHandleStatus(handle);
  const update = useUpdateProfile();

  async function submit() {
    setError(undefined);
    try {
      await update.mutateAsync({ handle });
      onDone();
    } catch (e) {
      setError(toUserMessage(e));
    }
  }

  return (
    <div className={styles.step}>
      <p className={styles.text}>Your handle is how other brewers will find you.</p>
      <HandleField
        id="onboarding-handle"
        value={handle}
        onChange={setHandle}
        status={status}
        isChecking={isChecking}
        errorMessage={error}
      />
      <StepButtons
        onSkip={onSkip}
        continueButton={
          <Button
            size="lg"
            isDisabled={status !== 'ok' || isChecking}
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
        <Button size="lg" onPress={() => router.push('/recipes')}>
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
