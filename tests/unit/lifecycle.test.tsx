import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/query/keys';
import type { RecipeWithVersion } from '@/lib/recipes/fetch';
import type { RecipeListItem } from '@/lib/recipes/list';

const updates: Record<string, unknown>[] = [];
let outcome: { error: unknown } = { error: null };
let gate: Promise<void> = Promise.resolve();
const toastUndo = vi.fn<(message: string, onUndo: () => void) => void>();
const toastSuccess = vi.fn();
const toastError = vi.fn<(message: string, options?: { onRetry?: () => void }) => void>();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      update: (values: Record<string, unknown>) => {
        updates.push(values);
        return { eq: () => gate.then(() => outcome) };
      },
    }),
  }),
}));
vi.mock('@/components/ui/Toast/toast', () => ({
  toast: {
    undo: (m: string, f: () => void) => toastUndo(m, f),
    success: (m: string) => toastSuccess(m),
    error: (m: string, o?: { onRetry?: () => void }) => toastError(m, o),
  },
}));
vi.mock('@/lib/errors/report', () => ({ reportUnexpected: vi.fn() }));

const { useArchiveRecipe, useDeleteRecipe } = await import('@/lib/recipes/lifecycle');

const item = (id: string, over: Partial<RecipeListItem> = {}): RecipeListItem => ({
  id,
  slug: id,
  name: `Recipe ${id}`,
  method: 'pour_over',
  method_custom: null,
  visibility: 'private',
  archived_at: null,
  edited_at: '2026-11-10T10:00:00Z',
  last_brewed_at: null,
  latest_version_no: 1,
  dose_g: 15,
  brew_water_g: 250,
  bypass_g: 0,
  coffee_name: null,
  roaster: null,
  origin: null,
  ...over,
});

const bundle = (id: string, archived: string | null = null) =>
  ({
    recipe: { id, name: `Recipe ${id}`, archived_at: archived },
    version: {},
    versions: [],
    owner: { id: 'u', handle: 'me' },
  }) as unknown as RecipeWithVersion;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(queryKeys.recipes.mine(), [item('a'), item('b')]);
  client.setQueryData(queryKeys.recipe('me', 'a'), bundle('a'));
  client.setQueryData(queryKeys.recipe('me', 'b'), bundle('b'));
  // What the refetch after a save returns: the server's current copy (here, the same as the cache).
  client.setQueryDefaults(queryKeys.recipes.all(), {
    queryFn: async () => client.getQueryData(queryKeys.recipes.mine()),
    staleTime: Infinity,
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

const list = (client: QueryClient) =>
  client.getQueryData<RecipeListItem[]>(queryKeys.recipes.mine())!;
const page = (client: QueryClient, slug: string) =>
  client.getQueryData<RecipeWithVersion | null>(queryKeys.recipe('me', slug));

let release: () => void;
const hold = () => {
  gate = new Promise<void>((resolve) => (release = resolve));
};

beforeEach(() => {
  updates.length = 0;
  outcome = { error: null };
  gate = Promise.resolve();
  toastUndo.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
});

describe('useArchiveRecipe', () => {
  it('moves the recipe to Archived at once, saves it, and offers Undo', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useArchiveRecipe(), { wrapper });
    hold();

    act(() => result.current.mutate({ id: 'a', name: 'Recipe a', archived: true }));
    // Before the save finishes: the list and the open page already show it archived; b is untouched.
    await waitFor(() => expect(list(client).find((r) => r.id === 'a')!.archived_at).not.toBeNull());
    expect(page(client, 'a')!.recipe.archived_at).not.toBeNull();
    expect(list(client).find((r) => r.id === 'b')!.archived_at).toBeNull();
    expect(page(client, 'b')!.recipe.archived_at).toBeNull();

    await act(async () => release());
    await waitFor(() => expect(toastUndo).toHaveBeenCalledWith('Archived Recipe a', expect.any(Function)));
    expect(updates[0]).toEqual({ archived_at: expect.any(String) });
  });

  it('Undo restores it: archived_at goes back to null in the save and in the list', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useArchiveRecipe(), { wrapper });
    await act(async () => result.current.mutate({ id: 'a', name: 'Recipe a', archived: true }));
    await waitFor(() => expect(toastUndo).toHaveBeenCalled());

    const undo = toastUndo.mock.calls[0]![1];
    await act(async () => undo());
    await waitFor(() => expect(updates).toHaveLength(2));
    expect(updates[1]).toEqual({ archived_at: null });
    expect(list(client).find((r) => r.id === 'a')!.archived_at).toBeNull();
    expect(page(client, 'a')!.recipe.archived_at).toBeNull();
  });

  it('rolls back and offers Retry when the save fails', async () => {
    const { client, wrapper } = setup();
    outcome = { error: { code: 'XX000', message: 'boom' } };
    const { result } = renderHook(() => useArchiveRecipe(), { wrapper });

    await act(async () => result.current.mutate({ id: 'a', name: 'Recipe a', archived: true }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(list(client).find((r) => r.id === 'a')!.archived_at).toBeNull();
    expect(page(client, 'a')!.recipe.archived_at).toBeNull();
    expect(toastUndo).not.toHaveBeenCalled();

    // Retry runs the same save again.
    outcome = { error: null };
    await act(async () => toastError.mock.calls[0]![1]!.onRetry!());
    await waitFor(() => expect(updates).toHaveLength(2));
    expect(updates[1]).toEqual({ archived_at: expect.any(String) });
  });

  it('restoring says so and clears archived_at', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(queryKeys.recipes.mine(), [item('a', { archived_at: '2026-11-01T00:00:00Z' })]);
    const { result } = renderHook(() => useArchiveRecipe(), { wrapper });
    await act(async () => result.current.mutate({ id: 'a', name: 'Recipe a', archived: false }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Restored Recipe a'));
    expect(updates[0]).toEqual({ archived_at: null });
  });
});

describe('useDeleteRecipe', () => {
  it('removes the recipe from the list and from the open page at once, with Undo', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useDeleteRecipe(), { wrapper });
    hold();

    act(() => result.current.mutate({ id: 'a', name: 'Recipe a', deleted: true }));
    await waitFor(() => expect(list(client).map((r) => r.id)).toEqual(['b']));
    expect(page(client, 'a')).toBeNull();
    expect(page(client, 'b')).not.toBeNull();

    await act(async () => release());
    await waitFor(() => expect(toastUndo).toHaveBeenCalledWith('Deleted Recipe a', expect.any(Function)));
    expect(updates[0]).toEqual({ deleted_at: expect.any(String) });
  });

  it('Undo clears deleted_at and says it is restored', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useDeleteRecipe(), { wrapper });
    await act(async () => result.current.mutate({ id: 'a', name: 'Recipe a', deleted: true }));
    await waitFor(() => expect(toastUndo).toHaveBeenCalled());

    await act(async () => toastUndo.mock.calls[0]![1]());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Restored Recipe a'));
    expect(updates[1]).toEqual({ deleted_at: null });
  });

  it('puts the recipe back when the delete fails, and offers Retry', async () => {
    const { client, wrapper } = setup();
    outcome = { error: { code: 'XX000', message: 'boom' } };
    const { result } = renderHook(() => useDeleteRecipe(), { wrapper });

    await act(async () => result.current.mutate({ id: 'a', name: 'Recipe a', deleted: true }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(list(client).map((r) => r.id)).toEqual(['a', 'b']);
    expect(page(client, 'a')).not.toBeNull();
    expect(toastError.mock.calls[0]![1]!.onRetry).toBeTypeOf('function');
    expect(toastUndo).not.toHaveBeenCalled();
  });
});
