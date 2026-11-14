export const DELETE_PHRASE = 'DELETE';

/**
 * Does what was typed count as the confirmation phrase? Ignores case and surrounding spaces, so
 * "delete " (a phone's auto-capitalise or a trailing space) still works.
 */
export function isDeletePhrase(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toUpperCase() === DELETE_PHRASE;
}

export type PasswordCheck = 'ok' | 'wrong' | 'rate_limited' | 'error';

export type DeleteDeps = {
  /** Checks the password with a separate, non-persisting client, so no session is touched. */
  verifyPassword: (email: string, password: string) => Promise<PasswordCheck>;
  /** Deletes every file in `avatars/{userId}/` (Supabase won't delete a user who owns files). */
  removeAvatarFiles: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
};

export type DeleteErrorCode =
  'invalid_request' | 'wrong_password' | 'rate_limited' | 'delete_failed';

export type DeleteResult =
  { ok: true } | { ok: false; status: 400 | 403 | 429 | 500; code: DeleteErrorCode };

/**
 * The order matters: the password is checked first, then the files (so the user can be deleted),
 * then the user, whose deletion cascades to every row they own. Nothing is deleted if the typed
 * phrase or password is wrong.
 */
export async function deleteAccount(
  input: { user: { id: string; email?: string | null }; password: unknown; confirm: unknown },
  deps: DeleteDeps,
): Promise<DeleteResult> {
  const { user, password, confirm } = input;
  if (!isDeletePhrase(confirm) || typeof password !== 'string' || password === '' || !user.email) {
    return { ok: false, status: 400, code: 'invalid_request' };
  }

  const check = await deps.verifyPassword(user.email, password);
  if (check === 'wrong') return { ok: false, status: 403, code: 'wrong_password' };
  if (check === 'rate_limited') return { ok: false, status: 429, code: 'rate_limited' };
  if (check === 'error') return { ok: false, status: 500, code: 'delete_failed' };

  try {
    await deps.removeAvatarFiles(user.id);
    await deps.deleteUser(user.id);
  } catch {
    return { ok: false, status: 500, code: 'delete_failed' };
  }
  return { ok: true };
}
