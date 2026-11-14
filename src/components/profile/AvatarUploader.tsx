'use client';

import { useRef } from 'react';
import { Avatar } from '@/components/ui/Avatar/Avatar';
import { Button } from '@/components/ui/Button/Button';
import { useRemoveAvatar, useAvatarUrl, useUploadAvatar } from '@/lib/avatar/useAvatar';
import type { ProfileMe } from '@/lib/profile/useProfileMe';
import styles from './Profile.module.css';

const PROGRESS_TEXT = { idle: '', preparing: 'Preparing photo…', uploading: 'Uploading…' } as const;

/**
 * Photo picker for the signed-in user. `accept="image/*"` lets an iPhone offer the camera roll
 * and hand over a converted JPEG for HEIC photos. The picture is cropped and shrunk on the device.
 */
export function AvatarUploader({ profile }: { profile: ProfileMe }) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, isPending, stage, error } = useUploadAvatar();
  const remove = useRemoveAvatar();
  const url = useAvatarUrl(profile.avatar_path, profile.updated_at);
  const busy = isPending || remove.isPending;

  return (
    <div className={styles.uploader}>
      <Avatar name={profile.display_name} src={url} size="lg" decorative />
      <div className={styles.uploaderBody}>
        <div className={styles.uploaderButtons}>
          <Button
            variant="secondary"
            isPending={isPending}
            pendingLabel={PROGRESS_TEXT[stage] || 'Working…'}
            isDisabled={remove.isPending}
            onPress={() => input.current?.click()}
          >
            {profile.avatar_path ? 'Change photo' : 'Choose photo'}
          </Button>
          {profile.avatar_path ? (
            <Button
              variant="ghost"
              isPending={remove.isPending}
              pendingLabel="Removing…"
              isDisabled={isPending}
              onPress={() => remove.remove()}
            >
              Remove photo
            </Button>
          ) : null}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className={styles.fileInput}
          aria-label="Profile photo file"
          tabIndex={-1}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Clearing the value lets the same file be chosen again after an error.
            event.target.value = '';
            if (file) upload(file);
          }}
        />
        <p className={styles.uploaderStatus} role="status">
          {PROGRESS_TEXT[stage]}
        </p>
        {error ? (
          <p className={styles.uploaderError} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
