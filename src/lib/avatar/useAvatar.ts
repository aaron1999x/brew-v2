'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from '@/components/ui/Toast/toast';
import { currentUserId } from '@/lib/auth/useSession';
import { getPublicEnv } from '@/lib/env';
import { toUserMessage } from '@/lib/errors/messages';
import { reportUnexpected } from '@/lib/errors/report';
import { queryKeys } from '@/lib/query/keys';
import { createClient } from '@/lib/supabase/client';
import { avatarPath, avatarPaths, avatarUrl } from './crop';
import { AvatarError, processAvatar } from './process';

/** The photo's public URL for a profile row, or null for the initials fallback. */
export function useAvatarUrl(
  path: string | null | undefined,
  version: string | null | undefined,
): string | null {
  return avatarUrl(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, path, version);
}

export type AvatarStage = 'idle' | 'preparing' | 'uploading';

/**
 * Choose a photo, shrink it on the device, upload it and point the profile at it. `stage` drives
 * the progress text. A photo the person can fix by choosing another (not an image, too big) comes
 * back as `error`; anything else is a toast with Retry.
 */
export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<AvatarStage>('idle');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      setError(null);
      setStage('preparing');
      const { blob, type } = await processAvatar(file);
      setStage('uploading');
      const userId = await currentUserId();
      const supabase = createClient();
      const path = avatarPath(userId, type);
      const upload = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: type, cacheControl: '3600' });
      if (upload.error) throw upload.error;
      const update = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
      if (update.error) throw update.error;
      // The other format (a JPEG after a WebP, or the reverse) is no longer used.
      const stale = avatarPaths(userId).filter((p) => p !== path);
      await supabase.storage.from('avatars').remove(stale);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profileMe() });
      toast.success('Photo saved.');
    },
    onError: (e, file) => {
      if (e instanceof AvatarError) {
        setError(e.message);
        return;
      }
      reportUnexpected(e);
      toast.error(toUserMessage(e), { onRetry: () => mutation.mutate(file) });
    },
    onSettled: () => setStage('idle'),
  });

  return { upload: mutation.mutate, isPending: mutation.isPending, stage, error };
}

/** Removes the photo file and clears the profile's path. */
export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const userId = await currentUserId();
      const supabase = createClient();
      const removed = await supabase.storage.from('avatars').remove(avatarPaths(userId));
      if (removed.error) throw removed.error;
      const update = await supabase.from('profiles').update({ avatar_path: null }).eq('id', userId);
      if (update.error) throw update.error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profileMe() });
      toast.success('Photo removed.');
    },
    onError: (e) => {
      reportUnexpected(e);
      toast.error(toUserMessage(e), { onRetry: () => mutation.mutate() });
    },
  });
  return { remove: mutation.mutate, isPending: mutation.isPending };
}
