import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, initialsOf } from '@/components/ui/Avatar/Avatar';

describe('initialsOf', () => {
  it.each([
    ['Aaron Tan', 'AT'],
    ['aaron', 'A'],
    ['  mary   jane  watson ', 'MW'],
    ['Zoë Łukasz-Nguyễn', 'ZŁ'],
    ['@handle_1', 'H'],
    ['', '?'],
    ['   ', '?'],
    ['***', '?'],
  ])('%j → %s', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});

describe('Avatar', () => {
  it('is an image named after the person, with initials hidden from screen readers', () => {
    render(<Avatar name="Aaron Tan" />);
    const avatar = screen.getByRole('img', { name: 'Aaron Tan' });
    expect(avatar).toHaveTextContent('AT');
  });

  it('is hidden from assistive technology when decorative', () => {
    render(<Avatar name="Aaron Tan" decorative />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('gives a blank name a real label', () => {
    render(<Avatar name="   " />);
    expect(screen.getByRole('img', { name: 'Unknown user' })).toBeInTheDocument();
  });
});
