import { describe, expect, it } from 'vitest';
import { isConfirmType } from '@/lib/auth/constants';
import { isGuestOnlyPath, isProtectedPath, isTokenForward } from '@/lib/auth/routes';

describe('isProtectedPath', () => {
  it.each([
    '/home',
    '/recipes',
    '/recipes/abc',
    '/brew',
    '/profile',
    '/welcome',
    '/settings',
    '/settings/units',
    '/admin',
    '/admin/invites',
  ])('%s needs a session', (path) => expect(isProtectedPath(path)).toBe(true));

  it.each([
    '/',
    '/login',
    '/signup',
    '/auth/confirm',
    '/reset-password',
    '/goodbye',
    '/changelog',
    '/status',
    '/verified',
    '/dev/components',
    '/homework',
    '/settingsx',
  ])('%s is open to visitors', (path) => expect(isProtectedPath(path)).toBe(false));
});

describe('isGuestOnlyPath', () => {
  it.each(['/login', '/signup', '/signup/check-email', '/forgot-password'])('%s', (path) =>
    expect(isGuestOnlyPath(path)).toBe(true),
  );
  it.each(['/', '/home', '/auth/confirm', '/reset-password', '/loginx'])('%s is not', (path) =>
    expect(isGuestOnlyPath(path)).toBe(false),
  );
});

describe('isTokenForward', () => {
  const q = (s: string) => new URLSearchParams(s);
  it('forwards "/" with token_hash and type', () => {
    expect(isTokenForward('/', q('token_hash=abc&type=email'))).toBe(true);
  });
  it('needs both parameters and the root path', () => {
    expect(isTokenForward('/', q('token_hash=abc'))).toBe(false);
    expect(isTokenForward('/', q('type=email'))).toBe(false);
    expect(isTokenForward('/', q(''))).toBe(false);
    expect(isTokenForward('/home', q('token_hash=abc&type=email'))).toBe(false);
  });
});

describe('isConfirmType', () => {
  it('accepts the types in our email links', () => {
    expect(isConfirmType('email')).toBe(true);
    expect(isConfirmType('signup')).toBe(true);
    expect(isConfirmType('recovery')).toBe(true);
  });
  it('rejects anything else', () => {
    for (const value of ['invite', 'magiclink', 'email_change', '', null, undefined]) {
      expect(isConfirmType(value as string | null | undefined)).toBe(false);
    }
  });
});
