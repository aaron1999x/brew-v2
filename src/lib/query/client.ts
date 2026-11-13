import { QueryClient } from '@tanstack/react-query';

/** HTTP status carried by Supabase/PostgREST/fetch errors, if any. */
function statusOf(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

/** Retry twice on network or 5xx errors; never on 4xx (docs/phase-4-amendments.md §2). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  const status = statusOf(error);
  if (status !== undefined && status >= 400 && status < 500) return false;
  return true;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
        networkMode: 'offlineFirst',
      },
      mutations: {
        retry: false,
        networkMode: 'online',
      },
    },
  });
}
