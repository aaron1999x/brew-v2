import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlipClock, FlipNumber } from '@/components/brews/timer/FlipClock';

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
}

const flaps = (container: HTMLElement) => container.querySelectorAll('[class*="flap"]');

describe('FlipClock', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is a timer named by the time it shows, made of one card per part', () => {
    mockMatchMedia(false);
    const { container } = render(<FlipClock seconds={45} label="Brew clock" />);
    const clock = container.querySelector('[role="timer"]')!;
    expect(clock.getAttribute('aria-label')).toBe('Brew clock 0:45');
    expect(clock.getAttribute('data-time')).toBe('0:45');
    // m and ss: two cards, and the digits are hidden from assistive technology (the label has them).
    expect(clock.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);
    expect(clock.textContent).toContain('45');
  });

  it('is not a live region, so it never interrupts', () => {
    mockMatchMedia(false);
    const { container } = render(<FlipClock seconds={5} />);
    expect(container.querySelector('[aria-live]')).toBeNull();
  });

  it('shows hours from one hour on', () => {
    mockMatchMedia(false);
    const { container } = render(<FlipClock seconds={3725} />);
    expect(container.querySelector('[role="timer"]')!.getAttribute('data-time')).toBe('1:02:05');
    expect(container.querySelector('[role="timer"]')!.getAttribute('aria-label')).toBe('1:02:05');
  });

  it('never shows a negative or fractional time', () => {
    mockMatchMedia(false);
    const { container } = render(<FlipClock seconds={-3.7} />);
    expect(container.querySelector('[role="timer"]')!.getAttribute('data-time')).toBe('0:00');
    const again = render(<FlipClock seconds={9.9} />);
    expect(again.container.querySelector('[role="timer"]')!.getAttribute('data-time')).toBe('0:09');
  });

  it('folds a card over when its digit changes', () => {
    mockMatchMedia(false);
    const { container, rerender } = render(<FlipClock seconds={44} />);
    expect(flaps(container)).toHaveLength(0);
    rerender(<FlipClock seconds={45} />);
    // The seconds card flips: a top and a bottom flap.
    expect(flaps(container).length).toBe(2);
  });

  it('just changes the digits under reduced motion', () => {
    mockMatchMedia(true);
    const { container, rerender } = render(<FlipClock seconds={44} />);
    rerender(<FlipClock seconds={45} />);
    expect(flaps(container)).toHaveLength(0);
    expect(container.textContent).toContain('45');
  });

  it('shows the count-in number on one accent card', () => {
    mockMatchMedia(false);
    const { container } = render(<FlipNumber value={5} />);
    expect(container.textContent).toContain('5');
    expect(container.querySelector('[class*="accent"]')).not.toBeNull();
  });
});
