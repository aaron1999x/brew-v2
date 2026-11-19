import { describe, expect, it } from 'vitest';
import {
  parseAtPath,
  parseInternalPath,
  recipePath,
  toAtPath,
  toInternalPath,
} from '@/lib/recipes/paths';

describe('recipe paths', () => {
  it('builds the one public URL for a recipe', () => {
    expect(recipePath('aaron', 'morning-v60')).toBe('/@aaron/morning-v60');
  });

  it('reads @ paths, with and without a rest', () => {
    expect(parseAtPath('/@aaron')).toEqual({ handle: 'aaron', rest: '' });
    expect(parseAtPath('/@aaron/v60/v/2')).toEqual({ handle: 'aaron', rest: '/v60/v/2' });
    expect(parseAtPath('/@Aaron/v60')).toEqual({ handle: 'Aaron', rest: '/v60' });
  });

  it('ignores paths that are not @ paths', () => {
    expect(parseAtPath('/recipes')).toBeNull();
    expect(parseAtPath('/a/@aaron')).toBeNull();
    expect(parseAtPath('/@')).toBeNull();
    expect(parseAtPath('/')).toBeNull();
  });

  it('maps to the internal route and back, lowercasing the handle', () => {
    const at = parseAtPath('/@Aaron/v60/compare')!;
    expect(toInternalPath(at)).toBe('/u/aaron/v60/compare');
    expect(toAtPath(parseInternalPath('/u/aaron/v60/compare')!)).toBe('/@aaron/v60/compare');
  });

  it('only treats /u/<handle> as internal', () => {
    expect(parseInternalPath('/u')).toBeNull();
    expect(parseInternalPath('/users/aaron')).toBeNull();
    expect(parseInternalPath('/u/aaron')).toEqual({ handle: 'aaron', rest: '' });
  });
});
