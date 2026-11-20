import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/query/keys';
import type { Settings } from '@/lib/settings/useSettings';

const updates: { columns: Record<string, unknown> }[] = [];
const merges: unknown[] = [];
let userIdGate: Promise<void> = Promise.resolve();

vi.mock('@/lib/auth/useSession', () => ({
  useSession: () => ({ user: { id: 'u1' } }),
  // Like the real one, it takes a moment (a network round trip): the window where the old code lost data.
  currentUserId: async () => {
    await userIdGate;
    return 'u1';
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      update: (columns: Record<string, unknown>) => {
        updates.push({ columns });
        return { eq: async () => ({ error: null }) };
      },
    }),
    rpc: async (name: string, args: { p_patch: unknown }) => {
      expect(name).toBe('merge_onboarding');
      merges.push(args.p_patch);
      return { data: null, error: null };
    },
  }),
}));

vi.mock('@/components/ui/Toast/toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { useUpdateSettings } = await import('@/lib/settings/useSettings');

const base: Settings = {
  temp_unit: 'c',
  weight_unit: 'g',
  date_format: 'dmy',
  time_format: '24h',
  time_zone: 'UTC',
  theme: 'system',
  onboarding: {},
} as Settings;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.settings(), base);
  // The refetch after a save returns whatever the server holds; here, an old copy.
  client.setQueryDefaults(queryKeys.settings(), { queryFn: async () => base, staleTime: Infinity });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useUpdateSettings(), { wrapper }) };
}

beforeEach(() => {
  updates.length = 0;
  merges.length = 0;
  userIdGate = Promise.resolve();
});

describe('useUpdateSettings: onboarding saves', () => {
  it('sends only the patch to the database to merge, never a whole copy of the object', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.mutateAsync({ onboarding: { steps: { units: 'done' } } });
    });
    expect(merges).toEqual([{ steps: { units: 'done' } }]);
    expect(updates).toEqual([]);
  });

  it('saves unit columns with an ordinary update and the step through the merge', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.mutateAsync({ temp_unit: 'f', onboarding: { steps: { units: 'done' } } });
    });
    expect(updates).toEqual([{ columns: { temp_unit: 'f' } }]);
    expect(merges).toEqual([{ steps: { units: 'done' } }]);
  });

  it('makes no onboarding call for a save that has none', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.mutateAsync({ theme: 'dark' });
    });
    expect(updates).toEqual([{ columns: { theme: 'dark' } }]);
    expect(merges).toEqual([]);
  });

  it('keeps every step when the cache is overwritten with older data while saves are in flight', async () => {
    // The old failure: the "started" save finishes and refetches, the refetch lands between the next
    // save starting and running, and that save wrote the older copy over the step.
    let release!: () => void;
    userIdGate = new Promise<void>((resolve) => (release = resolve));
    const { result, client } = setup();

    act(() => {
      result.current.mutate({ onboarding: { started_at: '2026-11-20T10:00:00Z' } });
      result.current.mutate({ onboarding: { steps: { units: 'done' } } });
    });
    // A stale refetch replaces the optimistic cache before either save has run.
    act(() => {
      client.setQueryData(queryKeys.settings(), base);
    });
    await act(async () => {
      release();
    });

    await waitFor(() => expect(merges).toHaveLength(2));
    // Each save carried only its own change, so nothing the cache lost can be written back.
    expect(merges).toEqual(
      expect.arrayContaining([{ started_at: '2026-11-20T10:00:00Z' }, { steps: { units: 'done' } }]),
    );
    for (const sent of merges as { steps?: unknown; started_at?: unknown }[]) {
      expect(Object.keys(sent)).toHaveLength(1);
    }
  });
});

describe('useUpdateSettings: the screen updates at once', () => {
  it('adds the change to the cache before the save finishes, keeping earlier steps', async () => {
    let release!: () => void;
    userIdGate = new Promise<void>((resolve) => (release = resolve));
    const { result, client } = setup();
    client.setQueryData(queryKeys.settings(), { ...base, onboarding: { steps: { handle: 'done' } } });

    act(() => {
      result.current.mutate({ onboarding: { steps: { units: 'done' } } });
    });
    await waitFor(() =>
      expect(client.getQueryData<Settings>(queryKeys.settings())?.onboarding.steps).toEqual({
        handle: 'done',
        units: 'done',
      }),
    );
    await act(async () => {
      release();
    });
  });
});
