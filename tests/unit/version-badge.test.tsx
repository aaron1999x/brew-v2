import { act, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VersionBadge } from '@/components/ui/VersionBadge/VersionBadge';
import {
  compareVersions,
  isNewerThan,
  readLastViewed,
  writeLastViewed,
} from '@/lib/lastViewedVersion';

describe('compareVersions', () => {
  it('compares major, minor and patch numerically', () => {
    expect(compareVersions('1.0.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('0.2.0', '0.10.0')).toBeLessThan(0);
    expect(compareVersions('0.1.10', '0.1.9')).toBeGreaterThan(0);
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0);
  });

  it('ignores a pre-release suffix', () => {
    expect(compareVersions('0.2.0-beta.1', '0.2.0')).toBe(0);
  });
});

describe('isNewerThan', () => {
  it('is false when nothing was stored, equal or older', () => {
    expect(isNewerThan('0.2.0', null)).toBe(false);
    expect(isNewerThan('0.2.0', '0.2.0')).toBe(false);
    expect(isNewerThan('0.2.0', '0.3.0')).toBe(false);
  });
  it('is true only when the app is newer than the stored version', () => {
    expect(isNewerThan('0.2.0', '0.1.0')).toBe(true);
  });
});

describe('VersionBadge', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('links to /changelog; the accessible name starts with the visible text (WCAG 2.5.3)', () => {
    render(<VersionBadge version="0.1.0" />);
    const link = screen.getByRole('link', { name: 'v0.1.0, view changelog' });
    expect(link).toHaveAttribute('href', '/changelog');
    expect(link).toHaveTextContent('v0.1.0');
    // No aria-label: the name comes from the content and starts with the visible text.
    expect(link).not.toHaveAttribute('aria-label');
    const visible = link.querySelector('.num')?.textContent ?? '';
    expect('v0.1.0, view changelog'.startsWith(visible)).toBe(true);
  });

  it('shows no dot on the first visit and silently stores the current version', () => {
    render(<VersionBadge version="0.1.0" />);
    expect(screen.queryByRole('link', { name: /, new$/ })).toBeNull();
    expect(readLastViewed()).toBe('0.1.0');
  });

  it('shows the dot, and ", new" in the name, when the app is newer than the last viewed version', () => {
    writeLastViewed('0.1.0');
    render(<VersionBadge version="0.2.0" />);
    const link = screen.getByRole('link', { name: 'v0.2.0, view changelog, new' });
    expect(link.querySelector('[data-new]')).not.toBeNull();
    // Showing the badge must not mark the version as seen.
    expect(readLastViewed()).toBe('0.1.0');
  });

  it('clears the dot when the version is marked as viewed', () => {
    writeLastViewed('0.1.0');
    render(<VersionBadge version="0.2.0" />);
    expect(screen.getByRole('link', { name: /, new$/ })).toBeInTheDocument();
    act(() => writeLastViewed('0.2.0'));
    expect(screen.getByRole('link', { name: 'v0.2.0, view changelog' })).toBeInTheDocument();
  });

  it('still renders, without a dot, when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<VersionBadge version="0.1.0" />);
    expect(screen.getByRole('link', { name: 'v0.1.0, view changelog' })).toBeInTheDocument();
  });

  it('does not overwrite an older stored version while hydrating', async () => {
    writeLastViewed('0.1.0');
    const container = document.createElement('div');
    document.body.appendChild(container);
    // Server markup has no dot (storage does not exist there); hydration must keep the stored value.
    container.innerHTML = renderToString(<VersionBadge version="0.2.0" />);
    await act(async () => {
      hydrateRoot(container, <VersionBadge version="0.2.0" />);
    });
    expect(readLastViewed()).toBe('0.1.0');
    expect(container.querySelector('a')).toHaveTextContent('v0.2.0, view changelog, new');
    container.remove();
  });
});
