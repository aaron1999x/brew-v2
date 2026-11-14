import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCacheForTests } from '@/lib/env';
import { SuspendedBanner } from '@/components/shell/SuspendedBanner';

function setEnv(supportEmail: string) {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://brew.example.com');
  vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging');
  vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', supportEmail);
  resetEnvCacheForTests();
}

describe('SuspendedBanner', () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCacheForTests();
  });

  it('shows the contact line when NEXT_PUBLIC_SUPPORT_EMAIL is set', () => {
    setEnv('help@example.com');
    render(<SuspendedBanner />);
    expect(screen.getByText('Your account is suspended.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'help@example.com' });
    expect(link).toHaveAttribute('href', 'mailto:help@example.com');
  });

  it('leaves the contact line out when it is blank or missing', () => {
    setEnv('');
    render(<SuspendedBanner />);
    expect(screen.getByText('Your account is suspended.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/contact/i)).not.toBeInTheDocument();
  });
});
