/** Pure helpers for profile photos (no browser APIs, so they are unit-tested directly). */

export const AVATAR_SIZE = 512;
/** The `avatars` bucket refuses anything over 1 MB. */
export const AVATAR_MAX_BYTES = 1_048_576;

export type AvatarType = 'image/webp' | 'image/jpeg';

export type SquareCrop = { sx: number; sy: number; size: number };

/** The largest centred square inside a `width` × `height` image. */
export function squareCrop(width: number, height: number): SquareCrop {
  const size = Math.min(width, height);
  return { sx: Math.floor((width - size) / 2), sy: Math.floor((height - size) / 2), size };
}

/** WebP when the browser really encoded one, otherwise JPEG (Safari can't always encode WebP). */
export function pickAvatarType(encodedType: string): AvatarType {
  return encodedType === 'image/webp' ? 'image/webp' : 'image/jpeg';
}

const EXTENSION: Record<AvatarType, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg' };

/** Where a user's photo lives in the `avatars` bucket: `{user_id}/avatar.webp` or `.jpg`. */
export function avatarPath(userId: string, type: AvatarType): string {
  return `${userId}/avatar.${EXTENSION[type]}`;
}

/** Both names a photo could have, so uploading one type clears the other. */
export function avatarPaths(userId: string): string[] {
  return [avatarPath(userId, 'image/webp'), avatarPath(userId, 'image/jpeg')];
}

/**
 * The public URL of a stored photo. `version` (the profile's `updated_at`) is added as `?v=` so a
 * replaced photo isn't served from a cache under the same name.
 */
export function avatarUrl(
  supabaseUrl: string,
  path: string | null | undefined,
  version?: string | null,
): string | null {
  if (!path) return null;
  const base = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/avatars/${path}`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

/** Quality steps to try until the file fits the bucket limit. */
export const QUALITY_STEPS = [0.85, 0.75, 0.6, 0.45] as const;

export function isImageFile(file: { type: string; name?: string }): boolean {
  if (file.type) return file.type.startsWith('image/');
  // Some browsers leave `type` empty for HEIC photos; fall back to the extension.
  return /\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(file.name ?? '');
}
