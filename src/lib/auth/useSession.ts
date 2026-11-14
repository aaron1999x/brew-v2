'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/**
 * The signed-in user in client components. Starts as `isLoading` and settles with the first
 * auth event. A sign-out (here or in another tab) clears the TanStack Query cache so one
 * person's data can't be shown to the next.
 */
export function useSession(): { user: User | null; isLoading: boolean } {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ user: User | null; isLoading: boolean }>({
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') queryClient.clear();
      setState({ user: session?.user ?? null, isLoading: false });
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return state;
}

/**
 * The signed-in user's id, read from the stored session at the moment of a save. Mutations use
 * this instead of `useSession()`, whose state starts empty in every component that calls it and
 * so can still be "no user" when a save fires right after mount.
 */
export async function currentUserId(): Promise<string> {
  const { data } = await createClient().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('not_authenticated');
  return id;
}
