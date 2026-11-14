import { describe, expect, it } from 'vitest';
import {
  AUTH_ERROR_MESSAGES,
  ERROR_MESSAGES,
  MESSAGE_FALLBACK,
  MESSAGE_LINK_EXPIRED,
  MESSAGE_RATE_LIMITED,
  isUnexpectedError,
  toErrorCode,
  toUserMessage,
} from '@/lib/errors/messages';

describe('auth error codes (Supabase error.code, not message text)', () => {
  it.each([
    ['invalid_credentials', 'Email or password is wrong.'],
    ['email_not_confirmed', 'Confirm your email first.'],
    ['over_request_rate_limit', 'Too many attempts. Wait a minute and try again.'],
    ['over_email_send_rate_limit', 'Too many attempts. Wait a minute and try again.'],
    ['weak_password', 'Choose a password with at least 8 characters.'],
    ['same_password', 'Choose a different password from your current one.'],
    ['reauthentication_not_valid', 'Your current password is wrong.'],
    ['otp_expired', MESSAGE_LINK_EXPIRED],
    ['flow_state_expired', MESSAGE_LINK_EXPIRED],
    ['flow_state_not_found', MESSAGE_LINK_EXPIRED],
  ])('%s → %s', (code, message) => {
    expect(toUserMessage({ code, message: 'anything', status: 400 })).toBe(message);
    expect(AUTH_ERROR_MESSAGES[code]).toBe(message);
  });

  it('ignores the English message text', () => {
    expect(
      toUserMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
    ).toBe('Email or password is wrong.');
    expect(toUserMessage({ message: 'Invalid login credentials', status: 400 })).toBe(
      MESSAGE_FALLBACK,
    );
  });

  it('maps a bare 429 to the rate-limit message', () => {
    expect(toUserMessage({ status: 429, message: 'Too Many Requests' })).toBe(MESSAGE_RATE_LIMITED);
  });

  it('does not treat object prototype keys as codes', () => {
    expect(toUserMessage({ code: 'constructor' })).toBe(MESSAGE_FALLBACK);
    expect(toUserMessage({ code: '__proto__' })).toBe(MESSAGE_FALLBACK);
  });

  it('treats the known auth failures as expected (not sent to Sentry)', () => {
    expect(isUnexpectedError({ code: 'invalid_credentials' })).toBe(false);
    expect(
      isUnexpectedError({ code: 'unexpected_failure', message: 'Database error saving new user' }),
    ).toBe(true);
  });
});

describe('database error names added in M2', () => {
  it.each([
    ['invite_only', 'Sign-ups are invite-only right now.'],
    ['invite_used', "That person has already signed up, so the invite can't be removed."],
    ['email_invalid', 'Enter a valid email address.'],
    ['handle_taken', 'That handle is taken. Try another.'],
    ['handle_invalid', 'Use 3–30 lowercase letters, numbers or underscores.'],
    ['handle_reserved', "That handle isn't available. Try another."],
    ['handle_recently_used', "That handle isn't available. Try another."],
  ] as const)('%s', (code, message) => {
    expect(ERROR_MESSAGES[code]).toBe(message);
    expect(toErrorCode({ message: code })).toBe(code);
    expect(toUserMessage({ message: `${code}`, code: 'P0001' })).toBe(message);
  });
});
