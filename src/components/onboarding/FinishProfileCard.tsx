'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button/Button';
import { useProfileMe } from '@/lib/profile/useProfileMe';
import {
  ONBOARDING_STEPS,
  mergeOnboarding,
  pendingSteps,
  showChecklist,
} from '@/lib/settings/onboarding';
import { useSettings, useUpdateSettings } from '@/lib/settings/useSettings';
import styles from './Onboarding.module.css';

/**
 * "Finish your profile" on Home: lists the skipped or unfinished onboarding steps and links to
 * where each is done. Gone when everything is done or the person dismisses it. Renders nothing
 * while loading or on error (it is a nicety, not the page).
 */
export function FinishProfileCard() {
  const settings = useSettings();
  const profile = useProfileMe();
  const update = useUpdateSettings();

  if (!settings.data || !profile.data) return null;
  const facts = {
    handleConfirmed: profile.data.handle_confirmed,
    hasExperienceLevel: profile.data.experience_level !== null,
  };
  if (!showChecklist(settings.data.onboarding, facts)) return null;
  const pending = pendingSteps(settings.data.onboarding, facts);

  return (
    <section className={styles.checklist} aria-labelledby="finish-profile-title">
      <h2 id="finish-profile-title" className={styles.checklistTitle}>
        Finish your profile
      </h2>
      <ul className={styles.checklistList}>
        {pending.map((id) => (
          <li key={id}>
            <Link href={ONBOARDING_STEPS[id].href} className={styles.checklistLink}>
              {ONBOARDING_STEPS[id].checklistLabel}
            </Link>
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
        onPress={() =>
          update.mutate({
            onboarding: mergeOnboarding(settings.data.onboarding, { checklist_dismissed: true }),
          })
        }
      >
        Dismiss
      </Button>
    </section>
  );
}
