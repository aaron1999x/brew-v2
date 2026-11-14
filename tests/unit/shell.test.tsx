import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { isCurrent, isCurrentItem, navItems } from '@/components/shell/navItems';
import { NoticesBell, noticesLabel } from '@/components/shell/TopBar';

describe('navItems', () => {
  it('lists the five destinations with Brew in the centre', () => {
    expect(navItems.map((i) => i.label)).toEqual([
      'Home',
      'Recipes',
      'Brew',
      'Verified',
      'Profile',
    ]);
    expect(navItems[2]?.primary).toBe(true);
    expect(navItems.filter((i) => i.primary)).toHaveLength(1);
  });

  it('matches a page and its children but not look-alikes', () => {
    expect(isCurrent('/recipes', '/recipes')).toBe(true);
    expect(isCurrent('/recipes/123', '/recipes')).toBe(true);
    expect(isCurrent('/recipes-archive', '/recipes')).toBe(false);
    expect(isCurrent('/home', '/recipes')).toBe(false);
  });

  it('counts Settings and admin screens as Profile', () => {
    const profile = navItems.find((i) => i.href === '/profile')!;
    for (const path of ['/profile', '/settings', '/settings/units', '/admin/invites']) {
      expect(isCurrentItem(path, profile), path).toBe(true);
    }
    expect(isCurrentItem('/settings-old', profile)).toBe(false);
    const brew = navItems.find((i) => i.href === '/brew')!;
    expect(isCurrentItem('/settings/units', brew)).toBe(false);
  });
});

describe('notices bell', () => {
  it('puts the unread count in the accessible name', () => {
    expect(noticesLabel(0)).toBe('Notices');
    expect(noticesLabel(3)).toBe('Notices, 3 unread');
    render(<NoticesBell unread={3} />);
    expect(screen.getByRole('link', { name: 'Notices, 3 unread' })).toHaveAttribute(
      'href',
      '/notices',
    );
  });

  it('shows a capped visual badge that screen readers skip', () => {
    const { container } = render(<NoticesBell unread={120} />);
    expect(screen.getByRole('link', { name: 'Notices, 120 unread' })).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]:not(svg)')).toHaveTextContent('99+');
  });

  it('has no badge when everything is read', () => {
    const { container } = render(<NoticesBell unread={0} />);
    expect(container.querySelector('span')).toBeNull();
  });
});
