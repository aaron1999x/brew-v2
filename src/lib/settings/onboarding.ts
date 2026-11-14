import { z } from 'zod';

export const STEP_IDS = ['handle', 'units', 'gear', 'profile'] as const;
export type StepId = (typeof STEP_IDS)[number];

/**
 * Onboarding steps in order. `enabled: false` hides a step everywhere (welcome flow and the Home
 * checklist). M3 turns `gear` on when the gear screen exists.
 */
export const ONBOARDING_STEPS: Record<
  StepId,
  { title: string; checklistLabel: string; href: string; enabled: boolean }
> = {
  handle: {
    title: 'Pick your handle',
    checklistLabel: 'Pick your handle',
    href: '/settings/profile',
    enabled: true,
  },
  units: {
    title: 'Units and region',
    checklistLabel: 'Choose your units',
    href: '/settings/units',
    enabled: true,
  },
  gear: {
    title: 'Your gear',
    checklistLabel: 'Add your gear',
    href: '/settings/gear',
    enabled: false,
  },
  profile: {
    title: 'Photo and experience',
    checklistLabel: 'Add a photo and your experience level',
    href: '/settings/profile',
    enabled: true,
  },
};

const stepStatus = z.enum(['done', 'skipped']);

export const onboardingSchema = z.object({
  started_at: z.string().nullable().optional(),
  checklist_dismissed: z.boolean().optional(),
  steps: z
    .object({
      handle: stepStatus.optional(),
      units: stepStatus.optional(),
      gear: stepStatus.optional(),
      profile: stepStatus.optional(),
    })
    .optional(),
});

export type Onboarding = z.infer<typeof onboardingSchema>;

/** Reads the stored JSON; anything that doesn't match counts as "nothing done yet". */
export function parseOnboarding(value: unknown): Onboarding {
  const parsed = onboardingSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

/** Adds a change on top of what's stored, so one step never wipes another. */
export function mergeOnboarding(current: Onboarding, patch: Partial<Onboarding>): Onboarding {
  return {
    ...current,
    ...patch,
    steps: { ...current.steps, ...patch.steps },
  };
}

export function enabledSteps(): StepId[] {
  return STEP_IDS.filter((id) => ONBOARDING_STEPS[id].enabled);
}

/** Facts from the profile that finish a step even when onboarding never recorded it. */
export type ProfileFacts = { handleConfirmed: boolean; hasExperienceLevel: boolean };

export function isStepDone(id: StepId, onboarding: Onboarding, facts: ProfileFacts): boolean {
  if (onboarding.steps?.[id] === 'done') return true;
  if (id === 'handle') return facts.handleConfirmed;
  if (id === 'profile') return facts.hasExperienceLevel;
  return false;
}

/** Enabled steps that are skipped or not finished: what the Home checklist lists. */
export function pendingSteps(onboarding: Onboarding, facts: ProfileFacts): StepId[] {
  return enabledSteps().filter((id) => !isStepDone(id, onboarding, facts));
}

export function showChecklist(onboarding: Onboarding, facts: ProfileFacts): boolean {
  return !onboarding.checklist_dismissed && pendingSteps(onboarding, facts).length > 0;
}

/** The steps the welcome flow walks through: the handle step only when it still needs choosing. */
export function welcomeSteps(facts: ProfileFacts): StepId[] {
  return enabledSteps().filter((id) => id !== 'handle' || !facts.handleConfirmed);
}
