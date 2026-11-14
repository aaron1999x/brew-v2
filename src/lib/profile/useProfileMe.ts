'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/Toast/toast';
import { currentUserId, useSession } from '@/lib/auth/useSession';
import { toUserMessage } from '@/lib/errors/messages';
import { reportUnexpected } from '@/lib/errors/report';
import { queryKeys } from '@/lib/query/keys';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

export type ExperienceLevel = Database['public']['Enums']['experience_level'];

export const EXPERIENCE_LEVELS: readonly { value: ExperienceLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'enthusiast', label: 'Enthusiast' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'professional', label: 'Professional' },
  { value: 'competitor', label: 'Competitor' },
];

const COLUMNS =
  'id, handle, handle_confirmed, display_name, bio, avatar_path, experience_level, favourite_gear, is_verified, updated_at';

export type ProfileMe = Pick<
  Database['public']['Tables']['profiles']['Row'],
  | 'id'
  | 'handle'
  | 'handle_confirmed'
  | 'display_name'
  | 'bio'
  | 'avatar_path'
  | 'experience_level'
  | 'favourite_gear'
  | 'is_verified'
  | 'updated_at'
>;

/** The signed-in user's own profile (query key `['profile','me']`). */
export function useProfileMe() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.profileMe(),
    enabled: Boolean(user),
    queryFn: async (): Promise<ProfileMe> => {
      const { data, error } = await createClient()
        .from('profiles')
        .select(COLUMNS)
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export type ProfilePatch = Partial<
  Pick<
    Database['public']['Tables']['profiles']['Update'],
    'handle' | 'display_name' | 'bio' | 'avatar_path' | 'experience_level' | 'favourite_gear'
  >
>;

/**
 * Saves part of the profile. Not optimistic: the database can refuse (a handle taken a moment
 * ago), so the cache is refreshed from the server on success. Errors show as a toast; forms that
 * show the error next to the field use `mutateAsync` and catch it too.
 */
export function useUpdateProfile({ successMessage }: { successMessage?: string } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const userId = await currentUserId();
      const { error } = await createClient().from('profiles').update(patch).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profileMe() });
      if (successMessage) toast.success(successMessage);
    },
    onError: (error) => {
      reportUnexpected(error);
      toast.error(toUserMessage(error));
    },
  });
}
