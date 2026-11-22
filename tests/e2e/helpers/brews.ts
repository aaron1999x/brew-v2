import { expect } from '@playwright/test';
import type { TestUser, TestUsers } from './test-users';

/** A logged brew for `user` (made as that member, through `log_brew`), with every score filled in. */
export async function logBrewRpc(
  users: TestUsers,
  user: Pick<TestUser, 'email' | 'password'>,
  versionId: string,
  over: Record<string, unknown> = {},
) {
  const client = await users.clientFor(user);
  const { data, error } = await client.rpc('log_brew', {
    p_brew: {
      id: crypto.randomUUID(),
      recipe_version_id: versionId,
      brewed_at: new Date(Date.now() - 3_600_000).toISOString(),
      source: 'manual',
      overall: 8.5,
      sweetness: 7,
      acidity: 6.5,
      brightness: 6,
      body: 7.5,
      clarity: 8,
      balance: 7,
      aftertaste: 6.5,
      flavours: ['peach', 'floral'],
      notes: 'Sweet and clean',
      next_change: 'Grind a touch finer',
      drawdown_s: 172,
      ...over,
    } as never,
  });
  expect(error).toBeNull();
  return (data as { id: string }).id;
}
