// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isValidTestKey, readTestKey } from '@/lib/sentry/test-key';

describe('isValidTestKey', () => {
  it('accepts the exact key', () => {
    expect(isValidTestKey('s3cret-key', 's3cret-key')).toBe(true);
  });
  it('rejects a wrong key, including one of a different length', () => {
    expect(isValidTestKey('s3cret-kez', 's3cret-key')).toBe(false);
    expect(isValidTestKey('s3cret', 's3cret-key')).toBe(false);
    expect(isValidTestKey('s3cret-key-and-more', 's3cret-key')).toBe(false);
  });
  it('fails closed when the expected key is unset or empty', () => {
    expect(isValidTestKey('anything', undefined)).toBe(false);
    expect(isValidTestKey('', '')).toBe(false);
    expect(isValidTestKey(undefined, '')).toBe(false);
  });
  it('rejects a missing key', () => {
    expect(isValidTestKey(null, 's3cret-key')).toBe(false);
    expect(isValidTestKey(undefined, 's3cret-key')).toBe(false);
  });
});

describe('readTestKey', () => {
  it('reads ?key=', () => {
    expect(readTestKey(new Request('https://x.test/api/sentry-test?key=abc'))).toBe('abc');
  });
  it('reads a Bearer header', () => {
    const request = new Request('https://x.test/api/sentry-test', {
      headers: { authorization: 'Bearer abc' },
    });
    expect(readTestKey(request)).toBe('abc');
  });
  it('ignores other authorisation schemes and returns null when nothing is sent', () => {
    const basic = new Request('https://x.test/api/sentry-test', {
      headers: { authorization: 'Basic abc' },
    });
    expect(readTestKey(basic)).toBeNull();
    expect(readTestKey(new Request('https://x.test/api/sentry-test'))).toBeNull();
  });
});
