'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/Toast/toast';
import { toUserMessage } from '@/lib/errors/messages';
import { reportUnexpected } from '@/lib/errors/report';
import { queryKeys } from '@/lib/query/keys';
import { createClient } from '@/lib/supabase/client';

export type Invite = {
  email: string;
  invited_at: string;
  invited_by_handle: string | null;
  signed_up_at: string | null;
};

/** Admins only (the database raises `admin_only` for anyone else). */
export function useInvites() {
  return useQuery({
    queryKey: queryKeys.invites(),
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await createClient().rpc('admin_list_invites');
      if (error) throw error;
      return (data ?? []) as Invite[];
    },
  });
}

/** What an invite looks like when pasted into a message. */
export function inviteMessage(origin: string): string {
  return `You're invited to try the app. Sign up with this email address here: ${origin}/signup`;
}

export function useAddInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await createClient().rpc('admin_add_invite', { p_email: email });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invites() }),
    onError: (error) => reportUnexpected(error),
  });
}

export function useRemoveInvite() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await createClient().rpc('admin_remove_invite', { p_email: email });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invites() });
      toast.success('Invite removed.');
    },
    onError: (error, email) => {
      reportUnexpected(error);
      toast.error(toUserMessage(error), { onRetry: () => mutation.mutate(email) });
    },
  });
  return mutation;
}
