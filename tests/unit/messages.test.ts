import { describe, expect, it } from 'vitest';
import {
  ERROR_MESSAGES,
  MESSAGE_FALLBACK,
  MESSAGE_LOGIN_AGAIN,
  MESSAGE_NETWORK,
  MESSAGE_NO_PERMISSION,
  isUnexpectedError,
  toErrorCode,
  toUserMessage,
} from '@/lib/errors/messages';

describe('toUserMessage', () => {
  it('maps every named error to its message', () => {
    for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
      expect(toUserMessage({ code: 'P0001', message: code }), code).toBe(message);
    }
  });

  it('reads the raised code from a PostgREST error', () => {
    const err = {
      code: 'P0001',
      message: 'publish_limit',
      details: null,
      hint: 'New accounts can publish 5 recipes a day.',
    };
    expect(toUserMessage(err)).toBe(
      'New accounts can publish 5 recipes a day. Try again tomorrow.',
    );
    expect(toErrorCode(err)).toBe('publish_limit');
  });

  it('finds a code inside a longer message, but not inside another word', () => {
    expect(toUserMessage(new Error('ERROR: email_not_verified (context)'))).toBe(
      ERROR_MESSAGES.email_not_verified,
    );
    expect(toUserMessage({ message: 'xpublish_limitx' })).toBe(MESSAGE_FALLBACK);
  });

  it('accepts a bare string', () => {
    expect(toUserMessage('version_locked')).toBe(ERROR_MESSAGES.version_locked);
  });

  it('maps invite_only', () => {
    expect(toUserMessage({ code: 'P0001', message: 'invite_only' })).toBe(
      'Sign-ups are invite-only right now.',
    );
  });

  it('maps permission errors', () => {
    expect(
      toUserMessage({
        code: '42501',
        message: 'new row violates row-level security policy for table "recipes"',
      }),
    ).toBe(MESSAGE_NO_PERMISSION);
    expect(toUserMessage({ status: 403, message: 'forbidden' })).toBe(MESSAGE_NO_PERMISSION);
  });

  it('maps expired sessions', () => {
    expect(toUserMessage({ code: 'session_expired', status: 401, message: 'x' })).toBe(
      MESSAGE_LOGIN_AGAIN,
    );
    expect(toUserMessage({ code: 'PGRST301', message: 'JWT expired' })).toBe(MESSAGE_LOGIN_AGAIN);
    expect(toUserMessage({ status: 401, message: 'nope' })).toBe(MESSAGE_LOGIN_AGAIN);
  });

  it('maps network errors', () => {
    expect(toUserMessage(new TypeError('Failed to fetch'))).toBe(MESSAGE_NETWORK);
    expect(toUserMessage(new TypeError('Load failed'))).toBe(MESSAGE_NETWORK);
    expect(toUserMessage({ name: 'AuthRetryableFetchError', message: 'x', status: 0 })).toBe(
      MESSAGE_NETWORK,
    );
  });

  it('falls back for anything else, without leaking details', () => {
    expect(toUserMessage(new Error('select * from secrets exploded'))).toBe(MESSAGE_FALLBACK);
    expect(toUserMessage(null)).toBe(MESSAGE_FALLBACK);
    expect(toUserMessage(undefined)).toBe(MESSAGE_FALLBACK);
    expect(toUserMessage(42)).toBe(MESSAGE_FALLBACK);
  });

  it('flags only unknown errors as unexpected (for Sentry)', () => {
    expect(isUnexpectedError(new Error('boom'))).toBe(true);
    expect(isUnexpectedError({ message: 'publish_limit' })).toBe(false);
    expect(isUnexpectedError(new TypeError('Failed to fetch'))).toBe(false);
  });
});
