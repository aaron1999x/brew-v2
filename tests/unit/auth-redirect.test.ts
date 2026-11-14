import { describe, expect, it } from 'vitest';
import {
  authConfirmUrl,
  isAllowedOrigin,
  resolveOrigin,
  sanitizeNext,
  type OriginConfig,
} from '@/lib/auth/redirect';

describe('sanitizeNext', () => {
  it.each([
    '/home',
    '/recipes',
    '/recipes?filter=mine',
    '/@alice/my-recipe',
    '/settings/units#top',
    '/a/b/c?x=1&y=2',
    '/%2F/evil.com', // an encoded slash stays a path on this site
  ])('keeps the relative path %s', (path) => {
    expect(sanitizeNext(path)).toBe(path);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['no leading slash', 'home'],
    ['another site', 'https://evil.com'],
    ['protocol-relative', '//evil.com'],
    ['protocol-relative with path', '//evil.com/home'],
    ['backslash trick', '/\\evil.com'],
    ['backslash at start', '\\\\evil.com'],
    ['slash then backslash', '/\\/evil.com'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,hi'],
    ['mailto', 'mailto:a@b.co'],
    ['tab in the path', '/\t/evil.com'],
    ['newline in the path', '/home\nSet-Cookie: x=1'],
    ['carriage return', '/home\rx'],
    ['null byte', '/home\u0000'],
    ['delete character', '/home\u007f'],
    ['too long', `/${'a'.repeat(600)}`],
    ['whitespace then scheme', ' https://evil.com'],
  ])('rejects %s', (_label, value) => {
    expect(sanitizeNext(value)).toBeNull();
  });
});

describe('isAllowedOrigin', () => {
  const site = 'https://brew.example.com';
  const staging: OriginConfig = { appEnv: 'staging', siteUrl: site };
  const production: OriginConfig = { appEnv: 'production', siteUrl: site };
  const preview = 'https://brew-v2-git-feat-m2-aaron1999xs-projects.vercel.app';
  const preview2 = 'https://brew-v2-abc123-aaron1999xs-projects.vercel.app';

  it('always allows the configured site URL', () => {
    expect(isAllowedOrigin(site, staging)).toBe(true);
    expect(isAllowedOrigin(site, production)).toBe(true);
    expect(isAllowedOrigin(`${site}/`, production)).toBe(true);
  });

  describe('outside production', () => {
    it('allows localhost with a port', () => {
      expect(isAllowedOrigin('http://localhost:3000', staging)).toBe(true);
      expect(isAllowedOrigin('http://localhost:3210', { ...staging, appEnv: 'local' })).toBe(true);
    });

    it('allows this project’s Vercel previews', () => {
      expect(isAllowedOrigin(preview, staging)).toBe(true);
      expect(isAllowedOrigin(preview2, staging)).toBe(true);
    });

    it.each([
      'https://evil.com',
      'http://localhost', // no port
      'https://localhost:3000', // wrong scheme
      'http://localhost:3000.evil.com',
      'https://brew-v2-x-aaron1999xs-projects.vercel.app.evil.com',
      'https://brew-v2-x-someoneelse-projects.vercel.app',
      'https://other-x-aaron1999xs-projects.vercel.app',
      'http://brew-v2-x-aaron1999xs-projects.vercel.app', // not https
      'not a url',
      '',
    ])('rejects %s', (origin) => {
      expect(isAllowedOrigin(origin, staging)).toBe(false);
    });
  });

  describe('in production', () => {
    it('allows only the site URL', () => {
      expect(isAllowedOrigin(preview, production)).toBe(false);
      expect(isAllowedOrigin('http://localhost:3000', production)).toBe(false);
      expect(isAllowedOrigin('https://evil.com', production)).toBe(false);
    });
  });
});

describe('resolveOrigin and authConfirmUrl', () => {
  const config: OriginConfig = { appEnv: 'staging', siteUrl: 'https://brew.example.com/' };
  const preview = 'https://brew-v2-abc-aaron1999xs-projects.vercel.app';

  it('uses the current origin when it is allowed', () => {
    expect(resolveOrigin(preview, config)).toBe(preview);
    expect(authConfirmUrl(preview, config)).toBe(`${preview}/auth/confirm`);
  });

  it('falls back to the site URL for anything else', () => {
    expect(resolveOrigin('https://evil.com', config)).toBe('https://brew.example.com');
    expect(authConfirmUrl(null, config)).toBe('https://brew.example.com/auth/confirm');
    expect(authConfirmUrl('https://evil.com', config)).toBe(
      'https://brew.example.com/auth/confirm',
    );
  });

  it('never lets production use a preview origin', () => {
    expect(authConfirmUrl(preview, { ...config, appEnv: 'production' })).toBe(
      'https://brew.example.com/auth/confirm',
    );
  });
});
