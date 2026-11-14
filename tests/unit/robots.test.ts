import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';

describe('robots.txt', () => {
  const rules = robots().rules;
  const list = Array.isArray(rules) ? rules : [rules];

  it('lets crawlers see everything except /dev/', () => {
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ userAgent: '*', allow: '/', disallow: '/dev/' });
  });
});
