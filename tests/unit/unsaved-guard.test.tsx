import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const { useUnsavedGuard } = await import('@/components/recipes/editor/useUnsavedGuard');

const pop = () => window.dispatchEvent(new PopStateEvent('popstate'));

let push: ReturnType<typeof vi.spyOn>;
let back: ReturnType<typeof vi.spyOn>;
let go: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockClear();
  push = vi.spyOn(window.history, 'pushState');
  back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
  go = vi.spyOn(window.history, 'go').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup(dirty: boolean) {
  return renderHook(({ d }) => useUnsavedGuard(d, '/recipes'), { initialProps: { d: dirty } });
}

describe('useUnsavedGuard: the history entry', () => {
  it('adds one entry once there is something to lose, and only once', () => {
    const { rerender } = setup(false);
    expect(push).not.toHaveBeenCalled();
    rerender({ d: true });
    expect(push).toHaveBeenCalledTimes(1);
    rerender({ d: false });
    rerender({ d: true });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('asks on back with changes, stays on the form, and puts the entry back', () => {
    const { result } = setup(true);
    expect(result.current.prompt).toBeNull();
    push.mockClear();
    act(() => pop());
    expect(result.current.prompt).toBe('back');
    expect(push).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
  });

  it('carries on back when the changes were undone before pressing back', () => {
    const { result, rerender } = setup(true);
    rerender({ d: false });
    act(() => pop());
    expect(result.current.prompt).toBeNull();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('leaves an ordinary navigation (no entry of ours) to the router', () => {
    setup(false);
    act(() => pop());
    expect(back).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('closing the prompt keeps editing', () => {
    const { result } = setup(true);
    act(() => pop());
    act(() => result.current.closePrompt());
    expect(result.current.prompt).toBeNull();
  });
});

describe('useUnsavedGuard: Cancel and discarding', () => {
  it('Cancel with nothing to lose leaves at once', () => {
    const { result } = setup(false);
    act(() => result.current.requestCancel());
    expect(replace).toHaveBeenCalledWith('/recipes');
    expect(result.current.prompt).toBeNull();
  });

  it('Cancel with changes asks first, and discarding then goes back past our entry', () => {
    const { result } = setup(true);
    act(() => result.current.requestCancel());
    expect(result.current.prompt).toBe('cancel');
    expect(replace).not.toHaveBeenCalled();
    act(() => result.current.confirmLeave());
    // Our entry is still there: step back over it, and the pop takes the person on.
    expect(back).toHaveBeenCalledTimes(1);
    act(() => pop());
    expect(replace).toHaveBeenCalledWith('/recipes');
  });

  it('discarding after back/swipe-back goes two steps back, to the page before the form', () => {
    const { result } = setup(true);
    act(() => pop());
    expect(result.current.prompt).toBe('back');
    act(() => result.current.confirmLeave());
    expect(go).toHaveBeenCalledWith(-2);
  });

  it('goes to the fallback page anyway when the browser never reports the step back', () => {
    const { result } = setup(true);
    act(() => result.current.requestCancel());
    act(() => result.current.confirmLeave());
    expect(replace).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(500));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/recipes');
  });

  it('does not go twice when the pop does arrive in time', () => {
    const { result } = setup(true);
    act(() => result.current.leaveTo('/@me/v60'));
    act(() => pop());
    act(() => void vi.advanceTimersByTime(500));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/@me/v60');
  });

  it('after saving it goes straight to the recipe when no entry was added', () => {
    const { result } = setup(false);
    act(() => result.current.leaveTo('/@me/v60'));
    expect(replace).toHaveBeenCalledWith('/@me/v60');
    expect(back).not.toHaveBeenCalled();
  });

  it('after back/swipe-back with no earlier page, falls back to the list', () => {
    const { result } = setup(true);
    act(() => pop());
    act(() => result.current.confirmLeave());
    expect(go).toHaveBeenCalledWith(-2);
    act(() => void vi.advanceTimersByTime(500));
    expect(replace).toHaveBeenCalledWith('/recipes');
  });
});

describe('useUnsavedGuard: closing or reloading the tab', () => {
  const unload = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it('asks the browser to confirm only while there are unsaved changes', () => {
    const { rerender } = setup(false);
    expect(unload()).toBe(false);
    rerender({ d: true });
    expect(unload()).toBe(true);
    rerender({ d: false });
    expect(unload()).toBe(false);
  });

  it('stops listening when the editor goes away', () => {
    const { unmount } = setup(true);
    unmount();
    expect(unload()).toBe(false);
  });
});
