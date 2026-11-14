import { describe, expect, it } from 'vitest';
import {
  AVATAR_MAX_BYTES,
  AVATAR_SIZE,
  avatarPath,
  avatarPaths,
  avatarUrl,
  isImageFile,
  pickAvatarType,
  squareCrop,
} from '@/lib/avatar/crop';
import {
  MAX_FAVOURITE_GEAR,
  cleanFavouriteGear,
  gearCategoryLabel,
  parseFavouriteGear,
} from '@/lib/profile/gear';

describe('squareCrop', () => {
  it('centres a landscape photo', () => {
    expect(squareCrop(4000, 3000)).toEqual({ sx: 500, sy: 0, size: 3000 });
  });

  it('centres a portrait photo', () => {
    expect(squareCrop(3000, 4000)).toEqual({ sx: 0, sy: 500, size: 3000 });
  });

  it('keeps a square photo whole', () => {
    expect(squareCrop(800, 800)).toEqual({ sx: 0, sy: 0, size: 800 });
  });

  it('floors odd offsets so the crop never leaves the image', () => {
    const { sx, sy, size } = squareCrop(1001, 600);
    expect(size).toBe(600);
    expect(sx).toBe(200);
    expect(sy).toBe(0);
    expect(sx + size).toBeLessThanOrEqual(1001);
  });

  it('works for images smaller than the output size', () => {
    expect(squareCrop(100, 60)).toEqual({ sx: 20, sy: 0, size: 60 });
  });

  it('uses the agreed output size and bucket limit', () => {
    expect(AVATAR_SIZE).toBe(512);
    expect(AVATAR_MAX_BYTES).toBe(1024 * 1024);
  });
});

describe('avatar files and URLs', () => {
  it('uses WebP only when the browser really made one', () => {
    expect(pickAvatarType('image/webp')).toBe('image/webp');
    expect(pickAvatarType('image/png')).toBe('image/jpeg');
    expect(pickAvatarType('')).toBe('image/jpeg');
  });

  it('stores the photo under the user id', () => {
    expect(avatarPath('u-1', 'image/webp')).toBe('u-1/avatar.webp');
    expect(avatarPath('u-1', 'image/jpeg')).toBe('u-1/avatar.jpg');
    expect(avatarPaths('u-1')).toEqual(['u-1/avatar.webp', 'u-1/avatar.jpg']);
  });

  it('builds a cache-busted public URL, or null without a photo', () => {
    expect(
      avatarUrl('https://x.supabase.co/', 'u-1/avatar.webp', '2026-11-14T10:00:00+00:00'),
    ).toBe(
      'https://x.supabase.co/storage/v1/object/public/avatars/u-1/avatar.webp?v=2026-11-14T10%3A00%3A00%2B00%3A00',
    );
    expect(avatarUrl('https://x.supabase.co', 'u-1/avatar.jpg')).toBe(
      'https://x.supabase.co/storage/v1/object/public/avatars/u-1/avatar.jpg',
    );
    expect(avatarUrl('https://x.supabase.co', null, 'v')).toBeNull();
  });

  it('accepts images (including HEIC without a type) and rejects other files', () => {
    expect(isImageFile({ type: 'image/png' })).toBe(true);
    expect(isImageFile({ type: '', name: 'IMG_0001.HEIC' })).toBe(true);
    expect(isImageFile({ type: 'application/pdf', name: 'a.pdf' })).toBe(false);
    expect(isImageFile({ type: 'text/plain', name: 'a.png' })).toBe(false);
    expect(isImageFile({ type: '', name: 'notes.txt' })).toBe(false);
  });
});

describe('favourite gear', () => {
  it('reads valid entries and drops the rest', () => {
    expect(
      parseFavouriteGear([
        { category: 'grinder', name: 'Comandante C40' },
        { category: 'nope', name: 'x' },
        { category: 'kettle', name: '' },
        'text',
      ]),
    ).toEqual([{ category: 'grinder', name: 'Comandante C40' }]);
    expect(parseFavouriteGear(null)).toEqual([]);
  });

  it('keeps at most five', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ category: 'other', name: `item ${i}` }));
    expect(parseFavouriteGear(six)).toHaveLength(MAX_FAVOURITE_GEAR);
    expect(cleanFavouriteGear(six)).toHaveLength(MAX_FAVOURITE_GEAR);
  });

  it('cleans form rows: trims, drops empty names, falls back to "other"', () => {
    expect(
      cleanFavouriteGear([
        { category: 'grinder', name: '  Timemore C3  ' },
        { category: 'grinder', name: '   ' },
        { category: 'mystery', name: 'Thing' },
      ]),
    ).toEqual([
      { category: 'grinder', name: 'Timemore C3' },
      { category: 'other', name: 'Thing' },
    ]);
  });

  it('labels categories', () => {
    expect(gearCategoryLabel('grinder')).toBe('Grinder');
    expect(gearCategoryLabel('unknown')).toBe('Other');
  });
});
