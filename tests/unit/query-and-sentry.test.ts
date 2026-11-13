import type { ErrorEvent } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import { makeQueryClient, shouldRetry } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { scrubEvent } from '@/lib/sentry/options';

describe('query client defaults', () => {
  it('uses the agreed defaults', () => {
    const q = makeQueryClient().getDefaultOptions().queries;
    expect(q?.staleTime).toBe(30_000);
    expect(q?.refetchOnWindowFocus).toBe(true);
    expect(q?.networkMode).toBe('offlineFirst');
  });
  it('retries twice on network/5xx errors, never on 4xx', () => {
    expect(shouldRetry(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetry(1, { status: 503 })).toBe(true);
    expect(shouldRetry(2, { status: 503 })).toBe(false);
    expect(shouldRetry(0, { status: 400 })).toBe(false);
    expect(shouldRetry(0, { status: 404 })).toBe(false);
  });
  it('builds stable keys', () => {
    expect(queryKeys.recipe('ann', 'v60')).toEqual(['recipe', 'ann', 'v60']);
    expect(queryKeys.gear()).toEqual(['gear']);
    expect(queryKeys.verified()).toEqual(['verified', 'all']);
  });
});

describe('sentry scrubbing', () => {
  it('drops email, ip, cookies, headers and bodies', () => {
    const event = {
      type: undefined,
      user: { id: 'u1', email: 'a@b.c', ip_address: '1.2.3.4', username: 'ann' },
      request: {
        url: 'https://x/y',
        cookies: { a: 'b' },
        headers: { cookie: 'x' },
        data: 'secret',
        query_string: 'q=1',
      },
    } as unknown as ErrorEvent;
    const out = scrubEvent(event);
    expect(out.user).toEqual({ id: 'u1' });
    expect(out.request).toEqual({ url: 'https://x/y' });
  });
  it('removes the user entirely when there is no id', () => {
    const out = scrubEvent({ type: undefined, user: { email: 'a@b.c' } } as unknown as ErrorEvent);
    expect(out.user).toBeUndefined();
  });
});
