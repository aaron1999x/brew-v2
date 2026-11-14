import { afterEach, describe, expect, it, vi } from 'vitest';
import { metadata } from '@/app/dev/components/page';
import ComponentsPage from '@/app/dev/components/page';
import FullscreenPreview from '@/app/(fullscreen)/dev/fullscreen/page';
import LoggedOutPreview from '@/app/(public)/dev/logged-out/page';

describe('which /dev pages exist in production', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('/dev/components renders in every environment, production included', () => {
    for (const env of ['production', 'staging', 'local']) {
      vi.stubEnv('NEXT_PUBLIC_APP_ENV', env);
      expect(() => ComponentsPage()).not.toThrow();
    }
  });

  it('/dev/components stays out of search engines', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('/dev/logged-out and /dev/fullscreen are still gated: they 404 in production only', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production');
    expect(() => LoggedOutPreview()).toThrow();
    expect(() => FullscreenPreview()).toThrow();

    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging');
    expect(() => LoggedOutPreview()).not.toThrow();
    expect(() => FullscreenPreview()).not.toThrow();
  });
});
