'use client';

import { Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { HandleField } from '@/components/auth/HandleField';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { Button } from '@/components/ui/Button/Button';
import {
  FormErrorSummary,
  type FormError,
} from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { Icon } from '@/components/ui/Icon/Icon';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { RadioGroup } from '@/components/ui/RadioGroup/RadioGroup';
import { Select } from '@/components/ui/Select/Select';
import { TextField } from '@/components/ui/TextField/TextField';
import { Textarea } from '@/components/ui/Textarea/Textarea';
import { toast } from '@/components/ui/Toast/toast';
import { HANDLE_MESSAGES, useHandleStatus } from '@/lib/auth/handle';
import { toUserMessage } from '@/lib/errors/messages';
import {
  GEAR_CATEGORIES,
  MAX_FAVOURITE_GEAR,
  MAX_GEAR_NAME,
  cleanFavouriteGear,
  parseFavouriteGear,
} from '@/lib/profile/gear';
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
  gear: (i: number) => `profile-gear-${i}`,
};

type GearRow = { key: number; category: string; name: string };

/** /settings/profile: photo, display name, handle (live check), bio, experience, favourite gear. */
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
  const [nextKey, setNextKey] = useState(100);
  const [gear, setGear] = useState<GearRow[]>(() =>
    parseFavouriteGear(profile.favourite_gear).map((g, i) => ({ key: i, ...g })),
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
        favourite_gear: cleanFavouriteGear(gear),
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

  function updateGear(key: number, patch: Partial<GearRow>) {
    setGear((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
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
      <fieldset className={styles.gearFieldset}>
        <legend className={styles.gearLegend}>Favourite gear</legend>
        <p className={styles.note}>Up to {MAX_FAVOURITE_GEAR} items. Free text for now.</p>
        <ul className={styles.gearList}>
          {gear.map((row, i) => (
            <li key={row.key} className={styles.gearRow}>
              <Select
                label={`Gear ${i + 1} category`}
                options={GEAR_CATEGORIES.map((c) => ({ id: c.value, label: c.label }))}
                selectedKey={row.category}
                onSelectionChange={(key) => updateGear(row.key, { category: String(key) })}
              />
              <TextField
                id={ID.gear(i)}
                label={`Gear ${i + 1} name`}
                value={row.name}
                onChange={(value) => updateGear(row.key, { name: value })}
                maxLength={MAX_GEAR_NAME}
              />
              <IconButton
                label={`Remove gear ${i + 1}`}
                icon={X}
                onPress={() => setGear((rows) => rows.filter((r) => r.key !== row.key))}
              />
            </li>
          ))}
        </ul>
        {gear.length < MAX_FAVOURITE_GEAR ? (
          <div>
            <Button
              variant="secondary"
              onPress={() => {
                setGear((rows) => [...rows, { key: nextKey, category: 'grinder', name: '' }]);
                setNextKey((k) => k + 1);
              }}
            >
              <Icon icon={Plus} size="sm" /> Add gear
            </Button>
          </div>
        ) : null}
      </fieldset>
      <Button type="submit" size="lg" isPending={update.isPending} pendingLabel="Saving…">
        Save changes
      </Button>
    </form>
  );
}
