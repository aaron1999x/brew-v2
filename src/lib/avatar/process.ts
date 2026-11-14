import {
  AVATAR_MAX_BYTES,
  AVATAR_SIZE,
  QUALITY_STEPS,
  isImageFile,
  pickAvatarType,
  squareCrop,
  type AvatarType,
} from './crop';

/** A problem the person can fix by choosing a different file. The message is ready to show. */
export class AvatarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AvatarError';
  }
}

export const MESSAGE_NOT_AN_IMAGE = 'Choose an image file (a photo or a picture).';
export const MESSAGE_UNREADABLE = "That photo couldn't be opened. Try a JPEG or PNG instead.";
export const MESSAGE_TOO_BIG = 'That photo is too big even after shrinking. Try a different one.';

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Turns whatever the person chose into a 512 × 512 square photo under 1 MB: decode (EXIF
 * rotation applied), centre-crop, draw on a canvas, encode as WebP, or JPEG when the browser
 * can't encode WebP. iPhone HEIC photos are converted by Safari when the picker asks for images.
 */
export async function processAvatar(file: File): Promise<{ blob: Blob; type: AvatarType }> {
  if (!isImageFile(file)) throw new AvatarError(MESSAGE_NOT_AN_IMAGE);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new AvatarError(MESSAGE_UNREADABLE);
  }

  try {
    const { sx, sy, size } = squareCrop(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new AvatarError(MESSAGE_UNREADABLE);
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    // Ask for WebP; a browser that can't encode it hands back a PNG, so check what came out.
    const probe = await toBlob(canvas, 'image/webp', QUALITY_STEPS[0]);
    const type = pickAvatarType(probe?.type ?? '');
    for (const quality of QUALITY_STEPS) {
      const blob =
        type === 'image/webp' && quality === QUALITY_STEPS[0] && probe
          ? probe
          : await toBlob(canvas, type, quality);
      if (blob && blob.type === type && blob.size <= AVATAR_MAX_BYTES) return { blob, type };
    }
    throw new AvatarError(MESSAGE_TOO_BIG);
  } finally {
    bitmap.close();
  }
}
