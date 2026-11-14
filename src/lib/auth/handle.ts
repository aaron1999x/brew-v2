'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';

export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

/** Same format rule as the database (`handle_status` 'invalid'). Cheap check before asking the server. */
export function isValidHandleFormat(handle: string): boolean {
  return HANDLE_PATTERN.test(handle);
}

export type HandleStatus = 'ok' | 'invalid' | 'reserved' | 'taken';

export const HANDLE_MESSAGES: Record<Exclude<HandleStatus, 'ok'>, string> = {
  invalid: 'Use 3–30 lowercase letters, numbers or underscores.',
  reserved: "That handle isn't available. Try another.",
  taken: 'That handle is taken. Try another.',
};

/** Returns `value` after it has stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Live handle check (RPC `handle_status`). Only asks the server for handles that already pass
 * the format rule. `isChecking` is true while the typed value hasn't settled or is in flight.
 */
export function useHandleStatus(handle: string) {
  const debounced = useDebouncedValue(handle);
  const formatOk = isValidHandleFormat(debounced);
  const query = useQuery({
    queryKey: queryKeys.handleStatus(debounced),
    enabled: formatOk,
    staleTime: 10_000,
    queryFn: async (): Promise<HandleStatus> => {
      const { data, error } = await createClient().rpc('handle_status', { p_handle: debounced });
      if (error) throw error;
      return data as HandleStatus;
    },
  });

  const settled = debounced === handle;
  let status: HandleStatus | null = null;
  if (handle === '') status = null;
  else if (!isValidHandleFormat(handle)) status = 'invalid';
  else if (settled && query.data) status = query.data;

  return {
    status,
    isChecking: handle !== '' && isValidHandleFormat(handle) && (!settled || query.isFetching),
    isError: query.isError,
  };
}

/** Up to 3 free handles near `base`, only fetched when asked (`enabled`). */
export function useHandleSuggestions(base: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.handleSuggestions(base),
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await createClient().rpc('handle_suggestions', { p_base: base });
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });
}
