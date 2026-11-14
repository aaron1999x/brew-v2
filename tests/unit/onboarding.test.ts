import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_STEPS,
  enabledSteps,
  isStepDone,
  mergeOnboarding,
  parseOnboarding,
  pendingSteps,
  showChecklist,
  welcomeSteps,
} from '@/lib/settings/onboarding';

const nothing = { handleConfirmed: true, hasExperienceLevel: false };

describe('onboarding shape', () => {
  it('reads valid JSON and treats garbage as empty', () => {
    expect(parseOnboarding({})).toEqual({});
    expect(
      parseOnboarding({ steps: { units: 'done' }, started_at: '2026-11-14T00:00:00Z' }),
    ).toEqual({
      steps: { units: 'done' },
      started_at: '2026-11-14T00:00:00Z',
    });
    expect(parseOnboarding({ steps: { units: 'maybe' } })).toEqual({});
    expect(parseOnboarding(null)).toEqual({});
    expect(parseOnboarding('x')).toEqual({});
  });

  it('merges a step change without losing the others', () => {
    const merged = mergeOnboarding(
      { started_at: 'now', steps: { units: 'done' } },
      { steps: { profile: 'skipped' } },
    );
    expect(merged).toEqual({ started_at: 'now', steps: { units: 'done', profile: 'skipped' } });
  });
});

describe('steps and checklist', () => {
  it('hides the gear step', () => {
    expect(ONBOARDING_STEPS.gear.enabled).toBe(false);
    expect(enabledSteps()).toEqual(['handle', 'units', 'profile']);
  });

  it('asks for a handle only while it is unconfirmed', () => {
    expect(welcomeSteps({ handleConfirmed: false, hasExperienceLevel: false })).toEqual([
      'handle',
      'units',
      'profile',
    ]);
    expect(welcomeSteps(nothing)).toEqual(['units', 'profile']);
  });

  it('lists skipped and untouched steps, not finished ones', () => {
    const onboarding = parseOnboarding({ steps: { units: 'skipped' } });
    expect(pendingSteps(onboarding, nothing)).toEqual(['units', 'profile']);
    expect(pendingSteps(parseOnboarding({ steps: { units: 'done' } }), nothing)).toEqual([
      'profile',
    ]);
  });

  it('counts facts from the profile as done', () => {
    expect(isStepDone('handle', {}, { handleConfirmed: true, hasExperienceLevel: false })).toBe(
      true,
    );
    expect(isStepDone('handle', {}, { handleConfirmed: false, hasExperienceLevel: false })).toBe(
      false,
    );
    expect(isStepDone('profile', {}, { handleConfirmed: true, hasExperienceLevel: true })).toBe(
      true,
    );
  });

  it('shows the checklist until everything is done or it is dismissed', () => {
    expect(showChecklist({}, nothing)).toBe(true);
    expect(showChecklist({ checklist_dismissed: true }, nothing)).toBe(false);
    const allDone = parseOnboarding({ steps: { units: 'done', profile: 'done' } });
    expect(showChecklist(allDone, nothing)).toBe(false);
  });
});
