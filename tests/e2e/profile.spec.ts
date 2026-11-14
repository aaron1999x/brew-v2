import { deflateSync, crc32 } from 'node:zlib';
import { expectNoAxeViolations } from './helpers/axe';
import { expect, signIn, test, waitForApp, type TestUsers } from './helpers/test-users';

// Uses the staging secret key from the runner's environment and skips without it. Service workers
// are blocked: nothing here needs one.
test.use({ serviceWorkers: 'block' });

/** A valid solid-colour PNG (wide, so the square crop has something to do). */
function makePng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x9a)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const PNG = makePng(600, 400);

async function profileRow(users: TestUsers, id: string) {
  const { data, error } = await users.admin
    .from('profiles')
    .select('display_name, handle, bio, avatar_path, experience_level, favourite_gear')
    .eq('id', id)
    .single();
  expect(error).toBeNull();
  return data!;
}

async function avatarFiles(users: TestUsers, id: string) {
  const { data } = await users.admin.storage.from('avatars').list(id);
  return (data ?? []).map((f) => ({ name: f.name, size: f.metadata?.size as number }));
}

test.describe('edit profile', () => {
  test('saves name, bio, level and favourite gear and shows them on the profile', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'editor');
    await page.goto('/settings/profile');
    await waitForApp(page);

    await page.getByLabel('Display name').fill('Test Brewer');
    await page.getByLabel('Bio').fill('Pour-over fan.');
    await expect(page.getByText('14/300')).toBeVisible();
    await page
      .getByRole('radiogroup', { name: 'Experience level' })
      .locator('label', { hasText: 'Advanced' })
      .click();
    await page.getByRole('button', { name: 'Add gear' }).click();
    await page.getByLabel('Gear 1 name').fill('Comandante C40');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Profile saved.')).toBeVisible();

    const row = await profileRow(users, user.id);
    expect(row).toMatchObject({
      display_name: 'Test Brewer',
      bio: 'Pour-over fan.',
      experience_level: 'advanced',
      favourite_gear: [{ category: 'grinder', name: 'Comandante C40' }],
    });

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Test Brewer' })).toBeVisible();
    await expect(page.getByText(`@${user.handle}`)).toBeVisible();
    await expect(page.getByText('Pour-over fan.')).toBeVisible();
    await expect(page.getByText('Advanced')).toBeVisible();
    await expect(page.getByText('Grinder: Comandante C40')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit profile' })).toBeVisible();
  });

  test('a bio over 300 characters or an empty name shows the error summary and keeps the text', async ({
    page,
    users,
  }) => {
    await signIn(page, users, 'invalid');
    await page.goto('/settings/profile');
    await waitForApp(page);

    await page.getByLabel('Display name').fill('');
    await page.getByLabel('Bio').fill('x'.repeat(301));
    await page.getByRole('button', { name: 'Save changes' }).click();

    const summary = page.getByRole('group', { name: /Fix 2 things/ });
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(page.getByText('Enter a display name (1–60 characters).').first()).toBeVisible();
    await expect(page.getByLabel('Bio')).toHaveValue('x'.repeat(301));
  });

  test('the handle is checked live, offers free suggestions, and a new one is saved', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'handler');
    const other = await users.create('taken');
    await page.goto('/settings/profile');
    await waitForApp(page);

    const handle = page.getByRole('textbox', { name: 'Handle' });
    await handle.fill(other.handle);
    await expect(page.getByText('That handle is taken. Try another.').first()).toBeVisible();
    await expect(page.getByRole('group', { name: 'Free handles you could use' })).toBeVisible();

    await handle.fill('ab');
    await expect(
      page.getByText('Use 3–30 lowercase letters, numbers or underscores.'),
    ).toBeVisible();

    const fresh = `h_${Date.now().toString(36)}`;
    await handle.fill(fresh);
    await expect(page.getByText('Available.')).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Profile saved.')).toBeVisible();
    expect((await profileRow(users, user.id)).handle).toBe(fresh);
  });
});

test.describe('profile photo', () => {
  test('choosing a photo shrinks it, stores it under the user id and shows it; removing deletes it', async ({
    page,
    users,
  }) => {
    const user = await signIn(page, users, 'photo');
    await page.goto('/settings/profile');
    await waitForApp(page);

    await page
      .getByLabel('Profile photo file')
      .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByText('Photo saved.')).toBeVisible();

    const row = await profileRow(users, user.id);
    expect(row.avatar_path).toMatch(new RegExp(`^${user.id}/avatar\\.(webp|jpg)$`));
    const files = await avatarFiles(users, user.id);
    expect(files).toHaveLength(1);
    expect(files[0]!.size).toBeLessThanOrEqual(1024 * 1024);
    await expect(page.getByRole('button', { name: 'Change photo' })).toBeVisible();

    // The saved photo is served from the public bucket.
    await page.goto('/profile');
    const image = page.locator('img[src*="/storage/v1/object/public/avatars/"]');
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);

    await page.goto('/settings/profile');
    await waitForApp(page);
    await page.getByRole('button', { name: 'Remove photo' }).click();
    await expect(page.getByText('Photo removed.')).toBeVisible();
    expect((await profileRow(users, user.id)).avatar_path).toBeNull();
    expect(await avatarFiles(users, user.id)).toEqual([]);
  });

  test('a file that is not an image is refused with a clear message', async ({ page, users }) => {
    const user = await signIn(page, users, 'notimage');
    await page.goto('/settings/profile');
    await waitForApp(page);
    await page
      .getByLabel('Profile photo file')
      .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.getByRole('alert').filter({ hasText: 'Choose an image file' })).toBeVisible();
    expect((await profileRow(users, user.id)).avatar_path).toBeNull();
  });

  test("storage refuses a file in another user's folder", async ({ users }) => {
    const a = await users.create('owner-a');
    const b = await users.create('owner-b');
    const client = await users.clientFor(a);
    const { error } = await client.storage
      .from('avatars')
      .upload(`${b.id}/avatar.webp`, PNG, { contentType: 'image/png' });
    expect(error).not.toBeNull();
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('profile and edit profile have no violations', async ({ page, users }) => {
      await signIn(page, users, 'axe-profile');
      await page.goto('/profile');
      await waitForApp(page);
      await expect(page.getByRole('link', { name: 'Edit profile' })).toBeVisible();
      await expectNoAxeViolations(page);

      await page.goto('/settings/profile');
      await waitForApp(page);
      await page.getByRole('button', { name: 'Add gear' }).click();
      await expect(page.getByLabel('Gear 1 name')).toBeVisible();
      await expectNoAxeViolations(page);

      await page.getByLabel('Display name').fill('');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByRole('group', { name: /Fix 1 thing/ })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  });
}
