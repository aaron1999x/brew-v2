'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { HandleField } from '@/components/auth/HandleField';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { Button } from '@/components/ui/Button/Button';
import {
  FormErrorSummary,
  type FormError,
} from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { Checkbox } from '@/components/ui/Checkbox/Checkbox';
import { RadioGroup } from '@/components/ui/RadioGroup/RadioGroup';
import { TextField } from '@/components/ui/TextField/TextField';
import { Textarea } from '@/components/ui/Textarea/Textarea';
import { toast } from '@/components/ui/Toast/toast';
import { HANDLE_MESSAGES, useHandleStatus } from '@/lib/auth/handle';
import { toUserMessage } from '@/lib/errors/messages';
import { useAddGear, useGear } from '@/lib/gear/hooks';
import {
  MAX_FAVOURITE_GEAR,
  buildFavouriteGear,
  gearCategoryLabel,
  isLinkedFavourite,
  parseFavouriteGear,
  type LegacyFavourite,
} from '@/lib/profile/gear';
import { gearDisplayName } from '@/lib/recipes/gear';
import {
  EXPERIENCE_LEVELS,
  useProfileMe,
  useUpdateProfile,
  type ExperienceLevel,
  type ProfileMe,
} from '@/lib/profile/useProfileMe';
import { AvatarUploader } from './AvatarUploader';
import styles from './Profile.module.css';

const BIO_MAX = 300;
const NAME_MAX = 60;
const NO_LEVEL = 'none';

const ID = {
  name: 'profile-display-name',
  handle: 'profile-handle',
  bio: 'profile-bio',
  favourites: 'profile-favourite-gear',
};

/** /settings/profile: photo, display name, handle (live check), bio, experience, favourite gear (chosen from my gear). */
export function ProfileForm() {
  const profile = useProfileMe();
  return (
    <QueryBoundary
      label="your profile"
      isLoading={profile.isPending}
      isError={profile.isError}
      onRetry={() => void profile.refetch()}
    >
      {profile.data ? <Form profile={profile.data} /> : null}
    </QueryBoundary>
  );
}

function Form({ profile }: { profile: ProfileMe }) {
  const [name, setName] = useState(profile.display_name);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [level, setLevel] = useState<string>(profile.experience_level ?? NO_LEVEL);
  const gear = useGear();
  const addGear = useAddGear();
  // Favourites: ids of my gear items in the order chosen, plus older free-text entries (M2) that
  // can be removed or turned into gear items.
  const [chosen, setChosen] = useState<string[]>(() =>
    parseFavouriteGear(profile.favourite_gear)
      .filter(isLinkedFavourite)
      .map((g) => g.item_id),
  );
  const [legacy, setLegacy] = useState<LegacyFavourite[]>(() =>
    parseFavouriteGear(profile.favourite_gear).filter((g) => !isLinkedFavourite(g)),
  );
  const [errors, setErrors] = useState<FormError[]>([]);
  const { status, isChecking } = useHandleStatus(handle);
  const update = useUpdateProfile();

  const fieldError = (id: string) => errors.find((e) => e.fieldId === id)?.message;

  function validate(): FormError[] {
    const found: FormError[] = [];
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > NAME_MAX) {
      found.push({ fieldId: ID.name, message: `Enter a display name (1–${NAME_MAX} characters).` });
    }
    if (handle !== profile.handle) {
      if (status && status !== 'ok') {
        found.push({ fieldId: ID.handle, message: HANDLE_MESSAGES[status] });
      } else if (!status || isChecking) {
        found.push({ fieldId: ID.handle, message: 'Wait for the handle check to finish.' });
      }
    }
    if (bio.length > BIO_MAX) {
      found.push({ fieldId: ID.bio, message: `Keep your bio to ${BIO_MAX} characters or fewer.` });
    }
    if (chosen.length + legacy.length > MAX_FAVOURITE_GEAR) {
      found.push({
        fieldId: ID.favourites,
        message: `Choose up to ${MAX_FAVOURITE_GEAR} favourite gear items.`,
      });
    }
    return found;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (found.length > 0) return;

    try {
      await update.mutateAsync({
        display_name: name.trim(),
        ...(handle !== profile.handle ? { handle } : {}),
        bio: bio.trim() === '' ? null : bio.trim(),
        experience_level: level === NO_LEVEL ? null : (level as ExperienceLevel),
        // Without the gear list loaded the favourites are left as they are.
        ...(gear.data ? { favourite_gear: buildFavouriteGear(chosen, gear.data, legacy) } : {}),
      });
      toast.success('Profile saved.');
    } catch (error) {
      const message = toUserMessage(error);
      // A handle taken a moment ago belongs next to the handle field.
      if (/handle/i.test(String((error as { message?: string })?.message ?? ''))) {
        setErrors([{ fieldId: ID.handle, message }]);
      }
    }
  }

  function toggleFavourite(id: string, on: boolean) {
    setChosen((ids) => (on ? [...ids.filter((i) => i !== id), id] : ids.filter((i) => i !== id)));
  }

  /** An older free-text favourite becomes one of my gear items, and stays a favourite. */
  async function addLegacyToGear(entry: LegacyFavourite) {
    try {
      const id = await addGear.mutateAsync({
        category: entry.category,
        catalog_id: null,
        custom_name: entry.name.slice(0, 80),
        nickname: null,
        notes: null,
      });
      setLegacy((rows) => rows.filter((r) => r !== entry));
      setChosen((ids) => [...ids, id]);
      toast.success('Added to your gear.');
    } catch {
      // The hook showed the error toast.
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className={styles.form} aria-label="Edit profile">
      <FormErrorSummary errors={errors} />
      <AvatarUploader profile={profile} />
      <TextField
        id={ID.name}
        name="name"
        label="Display name"
        autoComplete="name"
        value={name}
        onChange={setName}
        isRequired
        isInvalid={Boolean(fieldError(ID.name))}
        errorMessage={fieldError(ID.name)}
      />
      <div>
        <HandleField
          id={ID.handle}
          value={handle}
          onChange={setHandle}
          status={handle === profile.handle ? 'ok' : status}
          isChecking={handle !== profile.handle && isChecking}
          errorMessage={fieldError(ID.handle)}
        />
        <p className={styles.note}>
          Your old handle will keep working as a redirect for 90 days once public profiles exist.
        </p>
      </div>
      <div>
        <Textarea
          id={ID.bio}
          name="bio"
          label="Bio"
          value={bio}
          onChange={setBio}
          isInvalid={Boolean(fieldError(ID.bio))}
          errorMessage={fieldError(ID.bio)}
        />
        <p className={styles.counter} aria-live="polite">
          {bio.length}/{BIO_MAX}
        </p>
      </div>
      <RadioGroup
        label="Experience level"
        value={level}
        onChange={setLevel}
        options={[
          ...EXPERIENCE_LEVELS.map((l) => ({ value: l.value, label: l.label })),
          { value: NO_LEVEL, label: 'Prefer not to say' },
        ]}
      />
      <fieldset className={styles.gearFieldset} id={ID.favourites}>
        <legend className={styles.gearLegend}>Favourite gear</legend>
        <p className={styles.note}>Choose up to {MAX_FAVOURITE_GEAR} items from your gear.</p>
        {gear.isPending ? (
          <p className={styles.note}>Loading your gear…</p>
        ) : gear.isError ? (
          <p className={styles.note}>
            Couldn&apos;t load your gear.{' '}
            <Button variant="ghost" size="sm" onPress={() => void gear.refetch()}>
              Try again
            </Button>
          </p>
        ) : gear.data.length === 0 ? (
          <p className={styles.note}>
            You haven&apos;t added any gear yet. <Link href="/settings/gear">Add gear</Link>
          </p>
        ) : (
          <ul className={styles.gearList}>
            {gear.data.map((item) => (
              <li key={item.id}>
                <Checkbox
                  isSelected={chosen.includes(item.id)}
                  onChange={(on) => toggleFavourite(item.id, on)}
                >
                  {gearDisplayName(item)} ({gearCategoryLabel(item.category).toLowerCase()})
                </Checkbox>
              </li>
            ))}
          </ul>
        )}
        {legacy.length > 0 ? (
          <div>
            <p className={styles.note}>
              Older favourites, typed in before you could choose from your gear:
            </p>
            <ul className={styles.gearList}>
              {legacy.map((entry) => (
                <li key={`${entry.category}-${entry.name}`} className={styles.gearRow}>
                  <span>
                    {gearCategoryLabel(entry.category)}: {entry.name}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    isPending={addGear.isPending}
                    pendingLabel="Adding…"
                    onPress={() => void addLegacyToGear(entry)}
                  >
                    Add to my gear
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => setLegacy((rows) => rows.filter((r) => r !== entry))}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </fieldset>
      <Button type="submit" size="lg" isPending={update.isPending} pendingLabel="Saving…">
        Save changes
      </Button>
    </form>
  );
}
