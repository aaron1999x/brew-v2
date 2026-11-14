import { adminSkipReason, assertNoTestUsersLeft } from './helpers/test-users';

/** After the whole run: no @test.invalid users or allowlist rows may remain on staging. */
export default async function globalTeardown() {
  const reason = adminSkipReason();
  if (reason) {
    console.log(`[e2e] ${reason}`);
    return;
  }
  await assertNoTestUsersLeft();
  console.log('[e2e] No test users or allowlist rows left on staging.');
}
