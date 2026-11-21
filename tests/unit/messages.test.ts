import { describe, expect, it } from 'vitest';
import {
  CONSTRAINT_MESSAGES,
  ERROR_MESSAGES,
  MESSAGE_FALLBACK,
  MESSAGE_LOGIN_AGAIN,
  MESSAGE_NETWORK,
  MESSAGE_NO_PERMISSION,
  isUnexpectedError,
  toConstraintName,
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

  it('maps the M3 named errors', () => {
    expect(toUserMessage({ code: 'P0001', message: 'version_locked' })).toBe(
      'This version has brews, so your changes will be saved as a new version.',
    );
    expect(toUserMessage({ code: 'P0001', message: 'recipe_not_found' })).toBe(
      "This recipe isn't available any more.",
    );
    expect(toUserMessage({ code: 'P0001', message: 'immutable_field' })).toBe(
      ERROR_MESSAGES.immutable_field,
    );
    expect(toUserMessage({ code: 'P0001', message: 'steps_invalid' })).toBe(
      "Some steps aren't valid. Check the highlighted steps.",
    );
    expect(toUserMessage({ code: 'P0001', message: 'gear_not_found' })).toBe(
      'That gear item no longer exists.',
    );
  });

  it('maps the M4 brew errors', () => {
    const named = (message: string) => toUserMessage({ code: 'P0001', message });
    expect(named('version_not_found')).toBe("This recipe version isn't available any more.");
    expect(named('brew_not_found')).toBe("This brew isn't available any more.");
    expect(named('quick_change_invalid')).toBe(
      "This change can't be saved. Check grind, temperature, dose and water.",
    );
    expect(named('brew_conflict')).toBe("This brew couldn't be saved. Try again.");
    expect(named('overall_required')).toBe('Give the brew an overall score before saving.');
    for (const code of ['brew_not_found', 'quick_change_invalid', 'brew_conflict', 'overall_required']) {
      expect(isUnexpectedError({ code: 'P0001', message: code }), code).toBe(false);
    }
  });

  it('maps the brew check constraints by name', () => {
    const violation = (name: string) => ({
      code: '23514',
      message: `new row for relation "brews" violates check constraint "${name}"`,
    });
    expect(toUserMessage(violation('brews_flavours_valid'))).toBe(
      'Use up to 12 flavour tags of 30 characters or fewer, each added once.',
    );
    expect(toUserMessage(violation('brews_brewed_at_not_future'))).toBe("The brew time can't be in the future.");
    expect(toUserMessage(violation('brews_tds_pct_check'))).toBe('TDS is between 0 and 20%.');
    expect(toUserMessage(violation('brews_sweetness_check'))).toBe('Scores go from 0 to 10 in steps of 0.5.');
    expect(toUserMessage(violation('brews_overall_check'))).toBe('Scores go from 0 to 10 in steps of 0.5.');
    for (const name of [
      'brews_flavours_valid',
      'brews_brewed_at_not_future',
      'brews_tds_pct_check',
      'brews_beverage_g_check',
      'brews_drawdown_s_check',
      'brews_tasted_after_min_check',
      'brews_notes_check',
      'brews_next_change_check',
      'brews_sweetness_check',
      'brews_acidity_check',
      'brews_brightness_check',
      'brews_body_check',
      'brews_clarity_check',
      'brews_balance_check',
      'brews_aftertaste_check',
      'brews_overall_check',
    ]) {
      expect(toConstraintName(violation(name)), name).toBe(name);
      expect(isUnexpectedError(violation(name)), name).toBe(false);
    }
  });

  it('maps every named constraint from a Postgres violation message', () => {
    for (const [name, message] of Object.entries(CONSTRAINT_MESSAGES)) {
      const err = {
        code: name.startsWith('gear_') ? '23505' : '23514',
        message: name.startsWith('gear_')
          ? `duplicate key value violates unique constraint "${name}"`
          : `new row for relation "recipe_versions" violates check constraint "${name}"`,
        details: 'Failing row contains (…)',
      };
      expect(toConstraintName(err), name).toBe(name);
      expect(toUserMessage(err), name).toBe(message);
      expect(isUnexpectedError(err), name).toBe(false);
    }
    expect(
      toUserMessage({
        code: '23514',
        message:
          'new row for relation "recipe_versions" violates check constraint "recipe_versions_steps_shape"',
      }),
    ).toBe(ERROR_MESSAGES.steps_invalid);
  });

  it('leaves unknown constraints to the fallback', () => {
    const err = {
      code: '23514',
      message: 'new row for relation "recipes" violates check constraint "recipes_name_check"',
    };
    expect(toConstraintName(err)).toBeNull();
    expect(toUserMessage(err)).toBe(MESSAGE_FALLBACK);
    expect(toConstraintName({ message: 'violates check constraint "constructor"' })).toBeNull();
  });

  it('flags only unknown errors as unexpected (for Sentry)', () => {
    expect(isUnexpectedError(new Error('boom'))).toBe(true);
    expect(isUnexpectedError({ message: 'publish_limit' })).toBe(false);
    expect(isUnexpectedError(new TypeError('Failed to fetch'))).toBe(false);
  });
});
