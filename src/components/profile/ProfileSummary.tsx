'use client';

import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { Avatar } from '@/components/ui/Avatar/Avatar';
import { Badge, VerifiedBadge } from '@/components/ui/Badge/Badge';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { useAvatarUrl } from '@/lib/avatar/useAvatar';
import { EXPERIENCE_LEVELS, useProfileMe, type ProfileMe } from '@/lib/profile/useProfileMe';
import { parseFavouriteGear, gearCategoryLabel } from '@/lib/profile/gear';
import styles from './Profile.module.css';

/** The top of /profile: photo, names, verified badge, level, bio, favourite gear and the two buttons. */
export function ProfileSummary() {
  const profile = useProfileMe();
  return (
    <QueryBoundary
      label="your profile"
      isLoading={profile.isPending}
      isError={profile.isError}
      onRetry={() => void profile.refetch()}
    >
      {profile.data ? <Loaded profile={profile.data} /> : null}
    </QueryBoundary>
  );
}

function Loaded({ profile }: { profile: ProfileMe }) {
  const url = useAvatarUrl(profile.avatar_path, profile.updated_at);
  const level = EXPERIENCE_LEVELS.find((l) => l.value === profile.experience_level);
  const gear = parseFavouriteGear(profile.favourite_gear);

  return (
    <section className={styles.summary} aria-label="Your profile">
      <div className={styles.identity}>
        <Avatar name={profile.display_name} src={url} size="lg" decorative />
        <div className={styles.names}>
          <h2 className={styles.displayName}>
            {profile.display_name}
            {profile.is_verified ? <VerifiedBadge /> : null}
          </h2>
          <p className={styles.handle}>@{profile.handle}</p>
        </div>
      </div>
      {level ? (
        <ul className={styles.factRow} aria-label="Experience">
          <li>
            <Badge>{level.label}</Badge>
          </li>
        </ul>
      ) : null}
      {profile.bio ? <p className={styles.bio}>{profile.bio}</p> : null}
      {gear.length > 0 ? (
        <ul className={styles.factRow} aria-label="Favourite gear">
          {gear.map((g, i) => (
            <li key={`${g.category}-${g.name}-${i}`}>
              <Badge>{`${gearCategoryLabel(g.category)}: ${g.name}`}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.actions}>
        <ButtonLink href="/settings/profile" size="lg">
          Edit profile
        </ButtonLink>
        <ButtonLink href="/settings" variant="secondary" size="lg">
          Settings
        </ButtonLink>
      </div>
    </section>
  );
}
