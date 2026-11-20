'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button/Button';
import { useGear } from '@/lib/gear/hooks';
import { useProfileMe } from '@/lib/profile/useProfileMe';
import { ONBOARDING_STEPS, pendingSteps, showChecklist } from '@/lib/settings/onboarding';
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
  const gear = useGear();
  const update = useUpdateSettings();

  // Wait for the gear list too: a person who added gear in Settings shouldn't see "Add your gear".
  if (!settings.data || !profile.data || !gear.data) return null;
  const facts = {
    handleConfirmed: profile.data.handle_confirmed,
    hasExperienceLevel: profile.data.experience_level !== null,
    hasGear: gear.data.length > 0,
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
            onboarding: { checklist_dismissed: true },
          })
        }
      >
        Dismiss
      </Button>
    </section>
  );
}
